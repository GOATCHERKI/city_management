import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import issueRoutes from "./routes/issueRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const parseAllowedOrigins = () =>
  String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const getCorsOptions = () => {
  const configuredOrigins = parseAllowedOrigins();
  const developmentOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
  ];

  const allowedOrigins = configuredOrigins.length
    ? configuredOrigins
    : process.env.NODE_ENV === "production"
      ? []
      : developmentOrigins;

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  };
};

export const createApp = () => {
  const app = express();

  // Trust reverse proxy headers when deployed behind a load balancer.
  app.set("trust proxy", 1);

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again later." },
  });

  app.use(helmet());
  app.use(cors(getCorsOptions()));
  app.use(globalLimiter);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/issues", issueRoutes);
  app.use("/api/admin", adminRoutes);

  app.get("/", (req, res) => {
    res.json({ message: "Smart City backend is running" });
  });

  app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
  });

  app.use((err, req, res, next) => {
    console.error("Unhandled server error:", err);
    if (res.headersSent) {
      return next(err);
    }

    return res.status(err.status || 500).json({
      message: err.message || "Internal server error",
    });
  });

  return app;
};

export const app = createApp();
