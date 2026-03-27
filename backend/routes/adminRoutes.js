import express from "express";
import { authorizeRoles, verifyToken } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { adminMutationLimiter } from "../middlewares/rateLimiters.js";
import {
  listAdminAuditLogs,
  createDepartment,
  deleteDepartment,
  createUserByAdmin,
  listUsers,
  updateUserDepartment,
  updateUserRole,
  getDashboardStats,
} from "../controllers/adminController.js";
import {
  auditLogQuerySchema,
  createDepartmentSchema,
  createUserByAdminSchema,
  departmentIdParamSchema,
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
  "/departments",
  adminMutationLimiter,
  validateRequest({ bodySchema: createDepartmentSchema }),
  createDepartment,
);
router.delete(
  "/departments/:id",
  adminMutationLimiter,
  validateRequest({ paramsSchema: departmentIdParamSchema }),
  deleteDepartment,
);
router.post(
  "/users",
  adminMutationLimiter,
  validateRequest({ bodySchema: createUserByAdminSchema }),
  createUserByAdmin,
);
router.patch(
  "/users/:id/role",
  adminMutationLimiter,
  validateRequest({
    paramsSchema: userIdParamSchema,
    bodySchema: updateUserRoleSchema,
  }),
  updateUserRole,
);
router.patch(
  "/users/:id/department",
  adminMutationLimiter,
  validateRequest({
    paramsSchema: userIdParamSchema,
    bodySchema: updateUserDepartmentSchema,
  }),
  updateUserDepartment,
);

export default router;
