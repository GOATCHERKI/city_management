import { z } from "zod";

const roleEnum = z.enum(["citizen", "admin", "staff", "dept_admin"]);

const nullableDepartmentIdSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  return Number(value);
}, z.number().int().positive().nullable());

export const createUserByAdminSchema = z
  .object({
    cid: z.string().trim().min(1).max(50),
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
    role: roleEnum,
    departmentId: nullableDepartmentIdSchema.optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.role === "staff" || value.role === "dept_admin") &&
      !value.departmentId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["departmentId"],
        message:
          "departmentId is required for staff and department admin users",
      });
    }
  });

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value && value.length ? value : null)),
});

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const departmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateUserRoleSchema = z
  .object({
    role: roleEnum,
    departmentId: nullableDepartmentIdSchema.optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.role === "staff" || value.role === "dept_admin") &&
      !value.departmentId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["departmentId"],
        message: "departmentId is required when role is staff or dept_admin",
      });
    }
  });

export const updateUserDepartmentSchema = z.object({
  departmentId: nullableDepartmentIdSchema,
});

export const auditLogQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    actorCid: z.string().trim().min(1).max(50).optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    format: z.enum(["json", "csv"]).optional(),
    action: z
      .enum([
        "user.create",
        "user.role.update",
        "user.department.update",
        "department.create",
        "department.delete",
        "budget.upsert",
      ])
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "from must be less than or equal to to",
      });
    }
  });

export const dashboardQuerySchema = z.object({
  range: z.enum(["today", "7d", "30d"]).optional(),
});

export const createBudgetSchema = z.object({
  departmentId: z.coerce.number().int().positive(),
  category: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value && value.length ? value : null)),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
  totalAmount: z.coerce.number().min(0),
});

export const listBudgetQuerySchema = z.object({
  departmentId: z.coerce.number().int().positive().optional(),
  periodMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});
