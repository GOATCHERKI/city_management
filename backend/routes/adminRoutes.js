import express from "express";
import { authorizeRoles, verifyToken } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  listAdminAuditLogs,
  createUserByAdmin,
  listUsers,
  updateUserDepartment,
  updateUserRole,
  getDashboardStats,
} from "../controllers/adminController.js";
import {
  auditLogQuerySchema,
  createUserByAdminSchema,
  dashboardQuerySchema,
  updateUserDepartmentSchema,
  updateUserRoleSchema,
  userIdParamSchema,
} from "../validations/adminSchemas.js";

const router = express.Router();

router.use(verifyToken, authorizeRoles("admin"));

router.get("/users", listUsers);
router.get(
  "/dashboard",
  validateRequest({ querySchema: dashboardQuerySchema }),
  getDashboardStats,
);
router.get(
  "/audit-logs",
  validateRequest({ querySchema: auditLogQuerySchema }),
  listAdminAuditLogs,
);
router.post(
  "/users",
  validateRequest({ bodySchema: createUserByAdminSchema }),
  createUserByAdmin,
);
router.patch(
  "/users/:id/role",
  validateRequest({
    paramsSchema: userIdParamSchema,
    bodySchema: updateUserRoleSchema,
  }),
  updateUserRole,
);
router.patch(
  "/users/:id/department",
  validateRequest({
    paramsSchema: userIdParamSchema,
    bodySchema: updateUserDepartmentSchema,
  }),
  updateUserDepartment,
);

export default router;
