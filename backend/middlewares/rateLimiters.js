import rateLimit from "express-rate-limit";

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const createLimiter = ({
  windowMs,
  max,
  message,
  skipSuccessfulRequests = false,
}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    skip: () => process.env.NODE_ENV === "test",
    message: { message },
  });

const AUTH_WINDOW_MS = parsePositiveInt(
  process.env.RATE_LIMIT_AUTH_WINDOW_MS,
  15 * 60 * 1000,
);
const AUTH_MAX = parsePositiveInt(process.env.RATE_LIMIT_AUTH_MAX, 20);

const UPLOAD_WINDOW_MS = parsePositiveInt(
  process.env.RATE_LIMIT_UPLOAD_WINDOW_MS,
  10 * 60 * 1000,
);
const UPLOAD_MAX = parsePositiveInt(process.env.RATE_LIMIT_UPLOAD_MAX, 30);

const STATUS_WINDOW_MS = parsePositiveInt(
  process.env.RATE_LIMIT_STATUS_WINDOW_MS,
  10 * 60 * 1000,
);
const STATUS_MAX = parsePositiveInt(process.env.RATE_LIMIT_STATUS_MAX, 60);

const ADMIN_WINDOW_MS = parsePositiveInt(
  process.env.RATE_LIMIT_ADMIN_MUTATION_WINDOW_MS,
  10 * 60 * 1000,
);
const ADMIN_MAX = parsePositiveInt(
  process.env.RATE_LIMIT_ADMIN_MUTATION_MAX,
  80,
);

export const authLimiter = createLimiter({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX,
  message: "Too many auth attempts. Please try again later.",
});

export const uploadLimiter = createLimiter({
  windowMs: UPLOAD_WINDOW_MS,
  max: UPLOAD_MAX,
  message: "Too many image uploads. Please try again later.",
});

export const statusUpdateLimiter = createLimiter({
  windowMs: STATUS_WINDOW_MS,
  max: STATUS_MAX,
  message: "Too many status updates. Please try again later.",
});

export const adminMutationLimiter = createLimiter({
  windowMs: ADMIN_WINDOW_MS,
  max: ADMIN_MAX,
  message: "Too many admin changes. Please try again later.",
});
