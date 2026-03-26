import { z } from "zod";

export const registerSchema = z.object({
  cid: z.string().trim().min(1, "cid is required").max(50, "cid is too long"),
  fullName: z
    .string()
    .trim()
    .min(2, "fullName must be at least 2 characters")
    .max(120, "fullName is too long"),
  email: z.string().trim().email("email must be valid"),
  password: z
    .string()
    .min(8, "password must be at least 8 characters")
    .max(72, "password is too long"),
});

export const loginSchema = z.object({
  cid: z.string().trim().min(1, "cid is required"),
  password: z.string().min(1, "password is required"),
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, "token is required"),
});
