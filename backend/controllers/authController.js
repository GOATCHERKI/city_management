import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import crypto from "crypto";
import pool from "../db/client.js";

dotenv.config();

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 30;

const buildVerificationLink = (token) => {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
  return `${baseUrl}/api/auth/verify-email?token=${token}`;
};

const hashVerificationToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const signAuthToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      cid: user.cid,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

const handleAuthDbError = (res, error) => {
  if (error?.code === "23505") {
    const constraint = String(error.constraint || "");
    if (constraint.includes("cid")) {
      return res.status(409).json({ message: "CID already registered" });
    }

    if (constraint.includes("email")) {
      return res.status(409).json({ message: "Email already registered" });
    }

    return res.status(409).json({ message: "User already exists" });
  }

  console.error("Auth controller DB error:", error);
  return res.status(500).json({ message: "Internal server error" });
};

const getRequestBody = (req) => {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  return {};
};

export const registerUser = async (req, res) => {
  const { cid, fullName, email, password } = getRequestBody(req);
  if (!cid || !fullName || !email || !password)
    return res.status(400).json({
      message: "cid, fullName, email, and password are required.",
    });

  const normalizedCid = String(cid).trim().toLowerCase();
  const normalizedEmail = String(email).trim().toLowerCase();

  const hashedPassword = await bcrypt.hash(password, 10);
  const emailVerificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenHash = hashVerificationToken(emailVerificationToken);
  const verificationExpiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS,
  );

  try {
    const result = await pool.query(
      `
      INSERT INTO users (
        cid,
        full_name,
        email,
        password_hash,
        role,
        is_email_verified,
        verification_token_hash,
        verification_expires_at
      )
      VALUES ($1, $2, $3, $4, 'citizen', FALSE, $5, $6)
      RETURNING id, cid, full_name, email, role, is_email_verified, created_at;
      `,
      [
        normalizedCid,
        String(fullName).trim(),
        normalizedEmail,
        hashedPassword,
        verificationTokenHash,
        verificationExpiresAt,
      ],
    );

    const verifyLink = buildVerificationLink(emailVerificationToken);
    // Replace with real email transport (nodemailer/provider) in production.
    console.log(`Verification link for ${normalizedEmail}: ${verifyLink}`);

    return res.status(201).json({
      message:
        "User registered. Verify your email before login. Verification link logged on server.",
      user: result.rows[0],
    });
  } catch (error) {
    return handleAuthDbError(res, error);
  }
};

export const loginUser = async (req, res) => {
  const { cid, password } = getRequestBody(req);
  if (!cid || !password) {
    return res.status(400).json({ message: "cid and password are required." });
  }

  const normalizedCid = String(cid || "")
    .trim()
    .toLowerCase();

  try {
    const result = await pool.query(
      `
      SELECT id, cid, full_name, email, password_hash, role, is_email_verified
      FROM users
      WHERE cid = $1
      LIMIT 1;
      `,
      [normalizedCid],
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.is_email_verified) {
      return res.status(403).json({
        message: "Email not verified. Please verify your email first.",
      });
    }

    const token = signAuthToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        cid: user.cid,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return handleAuthDbError(res, error);
  }
};

export const verifyEmail = async (req, res) => {
  const body = getRequestBody(req);
  const token = String(req.query.token || body.token || "").trim();
  if (!token) {
    return res.status(400).json({ message: "Verification token is required" });
  }

  try {
    const tokenHash = hashVerificationToken(token);
    const result = await pool.query(
      `
      SELECT id, verification_expires_at
      FROM users
      WHERE verification_token_hash = $1
      LIMIT 1;
      `,
      [tokenHash],
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: "Invalid verification token" });
    }

    const user = result.rows[0];
    if (
      !user.verification_expires_at ||
      new Date(user.verification_expires_at) < new Date()
    ) {
      return res.status(400).json({ message: "Verification token expired" });
    }

    await pool.query(
      `
      UPDATE users
      SET is_email_verified = TRUE,
          verification_token_hash = NULL,
          verification_expires_at = NULL,
          updated_at = NOW()
      WHERE id = $1;
      `,
      [user.id],
    );

    return res.json({ message: "Email verified successfully" });
  } catch (error) {
    return handleAuthDbError(res, error);
  }
};
