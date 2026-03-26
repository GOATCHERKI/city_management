import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import issueRoutes from "./routes/issueRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy headers when deployed behind a load balancer.
app.set("trust proxy", 1);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many auth attempts. Please try again later." },
});

app.use(helmet());
app.use(cors());
app.use(globalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/auth", authLimiter, authRoutes);
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
