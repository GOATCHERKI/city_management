import { z } from "zod";

const statusEnum = z.enum(["pending", "in_progress", "resolved"]);

export const createIssueSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "title is too short")
    .max(160, "title is too long"),
  description: z
    .string()
    .trim()
    .min(5, "description is too short")
    .max(5000, "description is too long"),
  category: z
    .string()
    .trim()
    .min(2, "category is required")
    .max(80, "category is too long"),
  latitude: z.coerce
    .number()
    .min(-90, "latitude must be >= -90")
    .max(90, "latitude must be <= 90"),
  longitude: z.coerce
    .number()
    .min(-180, "longitude must be >= -180")
    .max(180, "longitude must be <= 180"),
  photo_url: z
    .string()
    .trim()
    .url("photo_url must be a valid URL")
    .optional()
    .or(z.literal("")),
  estimated_cost: z.coerce.number().min(0).optional(),
  budget_id: z.coerce.number().int().positive().optional(),
});

export const listIssuesQuerySchema = z.object({
  status: statusEnum.optional(),
  category: z.string().trim().min(1).max(80).optional(),
  department: z.coerce.number().int().positive().optional(),
});

export const issueIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const assignIssueSchema = z
  .object({
    departmentId: z.coerce.number().int().positive(),
    estimatedCost: z.coerce.number().min(0).optional(),
    budgetId: z.coerce.number().int().positive().optional(),
  })
  .superRefine((value, context) => {
    if (value.budgetId && value.estimatedCost === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["estimatedCost"],
        message: "estimatedCost is required when budgetId is provided",
      });
    }
  });

export const updateIssueStatusSchema = z.object({
  status: statusEnum,
  message: z.string().trim().max(2000).optional(),
  cost_added: z.coerce.number().min(0).optional(),
  photo_url: z
    .string()
    .trim()
    .url("photo_url must be a valid URL")
    .optional()
    .or(z.literal("")),
});
