import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const users = [];

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 30;

const buildVerificationLink = (token) => {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
  return `${baseUrl}/api/auth/verify-email?token=${token}`;
};

export const registerUser = async (req, res) => {
  const { cid, fullName, email, password } = req.body;
  if (!cid || !fullName || !email || !password)
    return res.status(400).json({ message: "Missing fields" });

  const normalizedCid = String(cid).trim().toLowerCase();
  const normalizedEmail = String(email).trim().toLowerCase();

  const duplicateCid = users.find((u) => u.cid === normalizedCid);
  if (duplicateCid)
    return res.status(409).json({ message: "CID already registered" });

  const duplicateEmail = users.find((u) => u.email === normalizedEmail);
  if (duplicateEmail)
    return res.status(409).json({ message: "Email already registered" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const emailVerificationToken = crypto.randomBytes(32).toString("hex");
  const emailVerificationExpiresAt = Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS;

  users.push({
    cid: normalizedCid,
    fullName,
    email: normalizedEmail,
    password: hashedPassword,
    isEmailVerified: false,
    emailVerificationToken,
    emailVerificationExpiresAt,
  });

  const verifyLink = buildVerificationLink(emailVerificationToken);
  // Replace with real email transport (nodemailer/provider) in production.
  console.log(`Verification link for ${normalizedEmail}: ${verifyLink}`);

  res.status(201).json({
    message:
      "User registered. Verify your email before login. Verification link logged on server.",
  });
};

export const loginUser = async (req, res) => {
  const { cid, password } = req.body;
  const normalizedCid = String(cid || "").trim().toLowerCase();
  const user = users.find((u) => u.cid === normalizedCid);
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ message: "Invalid credentials" });

  if (!user.isEmailVerified)
    return res.status(403).json({
      message: "Email not verified. Please verify your email first.",
    });

  const token = jwt.sign({ cid: user.cid, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  res.json({ token });
};

export const verifyEmail = (req, res) => {
  const token = String(req.query.token || req.body.token || "").trim();
  if (!token) {
    return res.status(400).json({ message: "Verification token is required" });
  }

  const user = users.find((u) => u.emailVerificationToken === token);
  if (!user) {
    return res.status(400).json({ message: "Invalid verification token" });
  }

  if (Date.now() > user.emailVerificationExpiresAt) {
    return res.status(400).json({ message: "Verification token expired" });
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = null;
  user.emailVerificationExpiresAt = null;

  return res.json({ message: "Email verified successfully" });
};
