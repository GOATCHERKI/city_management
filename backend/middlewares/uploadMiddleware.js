import multer from "multer";
import path from "path";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const hasSignature = (buffer, signature, offset = 0) => {
  if (!buffer || buffer.length < offset + signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i += 1) {
    if (buffer[offset + i] !== signature[i]) {
      return false;
    }
  }

  return true;
};

const isSupportedImageBuffer = (buffer) => {
  if (!buffer || buffer.length < 12) {
    return false;
  }

  const isJpeg = hasSignature(buffer, [0xff, 0xd8, 0xff]);
  const isPng = hasSignature(
    buffer,
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  const isGif =
    hasSignature(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    hasSignature(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  const isWebp =
    hasSignature(buffer, [0x52, 0x49, 0x46, 0x46], 0) &&
    hasSignature(buffer, [0x57, 0x45, 0x42, 0x50], 8);

  return isJpeg || isPng || isGif || isWebp;
};

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const extension = path.extname(String(file.originalname || "")).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    cb(
      new Error(
        "Unsupported file extension. Allowed: .jpg, .jpeg, .png, .webp, .gif",
      ),
    );
    return;
  }

  if (ALLOWED_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
    cb(null, true);
    return;
  }

  cb(new Error("Unsupported MIME type. Allowed image MIME types only."));
};

export const uploadIssuePhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("image");

export const validateUploadedImageContent = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: "Image file is required." });
  }

  if (!isSupportedImageBuffer(req.file.buffer)) {
    return res.status(400).json({
      message:
        "Invalid image content. Please upload a valid JPG, PNG, WEBP, or GIF image.",
    });
  }

  return next();
};
