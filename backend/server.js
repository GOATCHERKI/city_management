import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import issueRoutes from "./routes/issueRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/issues", issueRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Smart City backend is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
