import express from "express";
import { authorizeRoles, verifyToken } from "../middlewares/authMiddleware.js";
import {
  uploadIssuePhoto,
  validateUploadedImageContent,
} from "../middlewares/uploadMiddleware.js";
import {
  statusUpdateLimiter,
  uploadLimiter,
} from "../middlewares/rateLimiters.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  assignIssueToDepartment,
  createIssue,
  getDepartments,
  getIssueDetails,
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
  uploadLimiter,
  verifyToken,
  authorizeRoles("citizen", "staff", "admin"),
  (req, res, next) => {
    uploadIssuePhoto(req, res, (error) => {
      if (error) {
        return res.status(400).json({ message: error.message });
      }
      return next();
    });
  },
  validateUploadedImageContent,
  uploadIssueImage,
);

router.get(
  "/departments",
  verifyToken,
  authorizeRoles("admin", "staff"),
  getDepartments,
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
  authorizeRoles("admin", "staff"),
  validateRequest({ querySchema: listIssuesQuerySchema }),
  getAllIssues,
);
router.get(
  "/:id",
  verifyToken,
  authorizeRoles("staff", "admin"),
  validateRequest({ paramsSchema: issueIdParamSchema }),
  getIssueDetails,
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
  statusUpdateLimiter,
  verifyToken,
  authorizeRoles("staff", "admin"),
  validateRequest({
    paramsSchema: issueIdParamSchema,
    bodySchema: updateIssueStatusSchema,
  }),
  updateIssueStatus,
);

export default router;
