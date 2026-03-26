import express from "express";
import { authorizeRoles, verifyToken } from "../middlewares/authMiddleware.js";
import { uploadIssuePhoto } from "../middlewares/uploadMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  assignIssueToDepartment,
  createIssue,
  getAllIssues,
  getMyIssues,
  updateIssueStatus,
  uploadIssueImage,
} from "../controllers/issueController.js";
import {
  assignIssueSchema,
  createIssueSchema,
  issueIdParamSchema,
  listIssuesQuerySchema,
  updateIssueStatusSchema,
} from "../validations/issueSchemas.js";

const router = express.Router();

router.post(
  "/upload-image",
  verifyToken,
  authorizeRoles("citizen"),
  (req, res, next) => {
    uploadIssuePhoto(req, res, (error) => {
      if (error) {
        return res.status(400).json({ message: error.message });
      }
      return next();
    });
  },
  uploadIssueImage,
);

router.post(
  "/",
  verifyToken,
  authorizeRoles("citizen"),
  validateRequest({ bodySchema: createIssueSchema }),
  createIssue,
);
router.get("/my", verifyToken, authorizeRoles("citizen"), getMyIssues);
router.get(
  "/",
  verifyToken,
  authorizeRoles("admin"),
  validateRequest({ querySchema: listIssuesQuerySchema }),
  getAllIssues,
);
router.patch(
  "/:id/assign",
  verifyToken,
  authorizeRoles("admin"),
  validateRequest({
    paramsSchema: issueIdParamSchema,
    bodySchema: assignIssueSchema,
  }),
  assignIssueToDepartment,
);
router.patch(
  "/:id/status",
  verifyToken,
  authorizeRoles("staff", "admin"),
  validateRequest({
    paramsSchema: issueIdParamSchema,
    bodySchema: updateIssueStatusSchema,
  }),
  updateIssueStatus,
);

export default router;
