import express from "express";
import { validateRequest } from "../middlewares/validateRequest.js";
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
  validateRequest({ bodySchema: registerSchema }),
  registerUser,
);
router.post("/login", validateRequest({ bodySchema: loginSchema }), loginUser);
router.get(
  "/verify-email",
  validateRequest({ querySchema: verifyEmailSchema }),
  verifyEmail,
);
router.post(
  "/verify-email",
  validateRequest({ bodySchema: verifyEmailSchema }),
  verifyEmail,
);

export default router;
