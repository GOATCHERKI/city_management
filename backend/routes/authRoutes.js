import express from "express";
import { validateRequest } from "../middlewares/validateRequest.js";
import { authLimiter } from "../middlewares/rateLimiters.js";
import {
  registerUser,
  loginUser,
  verifyEmail,
} from "../controllers/authController.js";
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
} from "../validations/authSchemas.js";

const router = express.Router();

router.post(
  "/register",
  authLimiter,
  validateRequest({ bodySchema: registerSchema }),
  registerUser,
);
router.post(
  "/login",
  authLimiter,
  validateRequest({ bodySchema: loginSchema }),
  loginUser,
);
router.get(
  "/verify-email",
  authLimiter,
  validateRequest({ querySchema: verifyEmailSchema }),
  verifyEmail,
);
router.post(
  "/verify-email",
  authLimiter,
  validateRequest({ bodySchema: verifyEmailSchema }),
  verifyEmail,
);

export default router;
