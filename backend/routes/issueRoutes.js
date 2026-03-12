import express from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { uploadIssuePhoto } from "../middlewares/uploadMiddleware.js";
import {
  createIssue,
  getMyIssues,
  getAllIssues,
  assignIssueToDepartment,
  updateIssueStatus,
  uploadIssueImage,
} from "../controllers/issueController.js";

const router = express.Router();

router.post("/upload-image", verifyToken, (req, res, next) => {
  uploadIssuePhoto(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, uploadIssueImage);

router.post("/", verifyToken, createIssue);
router.get("/my", verifyToken, getMyIssues);
router.get("/", verifyToken, getAllIssues);
router.patch("/:id/assign", verifyToken, assignIssueToDepartment);
router.patch("/:id/status", verifyToken, updateIssueStatus);

export default router;
