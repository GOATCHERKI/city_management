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
  createBudget,
  listBudgets,
  getFinancialSummary,
} from "../controllers/adminController.js";
import {
  auditLogQuerySchema,
  createBudgetSchema,
  createDepartmentSchema,
  createUserByAdminSchema,
  departmentIdParamSchema,
  dashboardQuerySchema,
  listBudgetQuerySchema,
  updateUserDepartmentSchema,
  updateUserRoleSchema,
  userIdParamSchema,
} from "../validations/adminSchemas.js";

const router = express.Router();

router.use(verifyToken);

router.get("/users", authorizeRoles("admin", "dept_admin"), listUsers);
router.get(
  "/dashboard",
  authorizeRoles("admin"),
  validateRequest({ querySchema: dashboardQuerySchema }),
  getDashboardStats,
);
router.get(
  "/budgets",
  authorizeRoles("admin", "dept_admin"),
  validateRequest({ querySchema: listBudgetQuerySchema }),
  listBudgets,
);
router.post(
  "/budgets",
  authorizeRoles("admin", "dept_admin"),
  adminMutationLimiter,
  validateRequest({ bodySchema: createBudgetSchema }),
  createBudget,
);
router.get("/financial-summary", authorizeRoles("admin"), getFinancialSummary);
router.get(
  "/audit-logs",
  authorizeRoles("admin"),
  validateRequest({ querySchema: auditLogQuerySchema }),
  listAdminAuditLogs,
);
router.post(
  "/departments",
  authorizeRoles("admin"),
  adminMutationLimiter,
  validateRequest({ bodySchema: createDepartmentSchema }),
  createDepartment,
);
router.delete(
  "/departments/:id",
  authorizeRoles("admin"),
  adminMutationLimiter,
  validateRequest({ paramsSchema: departmentIdParamSchema }),
  deleteDepartment,
);
router.post(
  "/users",
  authorizeRoles("admin"),
  adminMutationLimiter,
  validateRequest({ bodySchema: createUserByAdminSchema }),
  createUserByAdmin,
);
router.patch(
  "/users/:id/role",
  authorizeRoles("admin"),
  adminMutationLimiter,
  validateRequest({
    paramsSchema: userIdParamSchema,
    bodySchema: updateUserRoleSchema,
  }),
  updateUserRole,
);
router.patch(
  "/users/:id/department",
  authorizeRoles("admin"),
  adminMutationLimiter,
  validateRequest({
    paramsSchema: userIdParamSchema,
    bodySchema: updateUserDepartmentSchema,
  }),
  updateUserDepartment,
);

export default router;
