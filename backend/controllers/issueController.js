import pool from "../db/client.js";
import imagekit from "../config/imagekit.js";

const ALLOWED_STATUSES = new Set(["pending", "in_progress", "resolved"]);

const isValidCoordinate = (value, min, max) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= min && num <= max;
};

const normalizeIssuePayload = (body) => {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const category = String(body.category || "").trim();
  const photoUrl = body.photo_url ? String(body.photo_url).trim() : null;

  return {
    title,
    description,
    category,
    photoUrl: photoUrl || null,
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
  };
};

const getAuthUserId = async (req) => {
  const rawId = req.user?.id;
  const userId = Number(rawId);
  if (Number.isInteger(userId) && userId > 0) {
    return userId;
  }

  const cid = String(req.user?.cid || "")
    .trim()
    .toLowerCase();
  if (!cid) {
    return null;
  }

  const result = await pool.query(
    "SELECT id FROM users WHERE cid = $1 LIMIT 1",
    [cid],
  );
  return result.rowCount ? Number(result.rows[0].id) : null;
};

const handleDbError = (res, error) => {
  if (error?.code === "23503") {
    return res
      .status(400)
      .json({ message: "Invalid reference data provided." });
  }

  if (error?.code === "23514") {
    return res
      .status(400)
      .json({ message: "Input violates data constraints." });
  }

  console.error("Issue controller DB error:", error);
  return res.status(500).json({ message: "Internal server error" });
};

export const uploadIssueImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Image file is required." });
  }

  if (!req.file.buffer || !req.file.buffer.length) {
    return res.status(400).json({ message: "Uploaded file is empty." });
  }

  try {
    const imageFile = new File([req.file.buffer], req.file.originalname || "issue-image", {
      type: req.file.mimetype || "application/octet-stream",
    });

    const result = await imagekit.files.upload({
      file: imageFile,
      fileName: `issue-${Date.now()}-${req.file.originalname}`,
      folder: "/smart-city/issues",
      useUniqueFileName: true,
    });

    return res.status(201).json({
      photo_url: result.url,
      fileId: result.fileId,
      thumbnail_url: result.thumbnailUrl,
    });
  } catch (error) {
    console.error("ImageKit upload error:", error);
    return res.status(500).json({ message: "Failed to upload image." });
  }
};

export const createIssue = async (req, res) => {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Invalid auth token payload." });
  }

  const payload = normalizeIssuePayload(req.body);
  if (!payload.title || !payload.description || !payload.category) {
    return res.status(400).json({
      message: "title, description, and category are required.",
    });
  }

  if (!isValidCoordinate(payload.latitude, -90, 90)) {
    return res
      .status(400)
      .json({ message: "latitude must be between -90 and 90." });
  }

  if (!isValidCoordinate(payload.longitude, -180, 180)) {
    return res
      .status(400)
      .json({ message: "longitude must be between -180 and 180." });
  }

  try {
    const query = `
      INSERT INTO issues (title, description, category, latitude, longitude, photo_url, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, title, description, category, latitude, longitude, status,
                created_by, assigned_department, photo_url, created_at, updated_at;
    `;

    const values = [
      payload.title,
      payload.description,
      payload.category,
      payload.latitude,
      payload.longitude,
      payload.photoUrl,
      userId,
    ];

    const result = await pool.query(query, values);
    return res.status(201).json({ issue: result.rows[0] });
  } catch (error) {
    return handleDbError(res, error);
  }
};

export const getMyIssues = async (req, res) => {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Invalid auth token payload." });
  }

  try {
    const query = `
      SELECT i.id, i.title, i.description, i.category, i.latitude, i.longitude,
             i.status, i.photo_url, i.assigned_department, i.created_at, i.updated_at,
             d.name AS assigned_department_name
      FROM issues i
      LEFT JOIN departments d ON d.id = i.assigned_department
      WHERE i.created_by = $1
      ORDER BY i.created_at DESC;
    `;

    const result = await pool.query(query, [userId]);
    return res.json({ issues: result.rows });
  } catch (error) {
    return handleDbError(res, error);
  }
};

export const getAllIssues = async (req, res) => {
  const { status, category, department } = req.query;
  const requesterRole = String(req.user?.role || "").toLowerCase();
  const requesterId = Number(req.user?.id);

  const conditions = [];
  const values = [];

  if (requesterRole === "staff") {
    if (!Number.isInteger(requesterId) || requesterId <= 0) {
      return res.status(401).json({ message: "Invalid auth token payload." });
    }

    const userResult = await pool.query(
      "SELECT department_id FROM users WHERE id = $1 LIMIT 1",
      [requesterId],
    );

    const departmentId = userResult.rows[0]?.department_id;
    if (!departmentId) {
      return res.json({ issues: [] });
    }

    values.push(Number(departmentId));
    conditions.push(`i.assigned_department = $${values.length}`);
  }

  if (status) {
    if (!ALLOWED_STATUSES.has(String(status))) {
      return res.status(400).json({ message: "Invalid status filter." });
    }
    values.push(String(status));
    conditions.push(`i.status = $${values.length}`);
  }

  if (category) {
    values.push(String(category).trim());
    conditions.push(`LOWER(i.category) = LOWER($${values.length})`);
  }

  if (department) {
    const departmentId = Number(department);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return res.status(400).json({ message: "Invalid department filter." });
    }
    values.push(departmentId);
    conditions.push(`i.assigned_department = $${values.length}`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const query = `
      SELECT i.id, i.title, i.description, i.category, i.latitude, i.longitude,
             i.status, i.photo_url, i.created_by, i.assigned_department,
             i.created_at, i.updated_at,
             d.name AS assigned_department_name,
             u.full_name AS created_by_name
      FROM issues i
      LEFT JOIN departments d ON d.id = i.assigned_department
      LEFT JOIN users u ON u.id = i.created_by
      ${whereClause}
      ORDER BY i.created_at DESC;
    `;

    const result = await pool.query(query, values);
    return res.json({ issues: result.rows });
  } catch (error) {
    return handleDbError(res, error);
  }
};

export const getDepartments = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, description
      FROM departments
      ORDER BY name ASC;
      `,
    );

    return res.json({ departments: result.rows });
  } catch (error) {
    return handleDbError(res, error);
  }
};

export const assignIssueToDepartment = async (req, res) => {
  const issueId = Number(req.params.id);
  const departmentId = Number(req.body.departmentId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({ message: "Invalid issue id." });
  }

  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return res
      .status(400)
      .json({ message: "departmentId must be a positive integer." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const deptResult = await client.query(
      "SELECT id FROM departments WHERE id = $1",
      [departmentId],
    );
    if (deptResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Department not found." });
    }

    const issueResult = await client.query(
      `
      UPDATE issues
      SET assigned_department = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, title, status, assigned_department, updated_at;
      `,
      [departmentId, issueId],
    );

    if (issueResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found." });
    }

    await client.query("COMMIT");
    return res.json({ issue: issueResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleDbError(res, error);
  } finally {
    client.release();
  }
};

export const updateIssueStatus = async (req, res) => {
  const issueId = Number(req.params.id);
  const status = String(req.body.status || "").trim();
  const message = req.body.message ? String(req.body.message).trim() : null;
  const actorId = await getAuthUserId(req);

  if (!actorId) {
    return res.status(401).json({ message: "Invalid auth token payload." });
  }

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({ message: "Invalid issue id." });
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({
      message: "status must be one of: pending, in_progress, resolved.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const issueResult = await client.query(
      `
      UPDATE issues
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, title, status, assigned_department, updated_at;
      `,
      [status, issueId],
    );

    if (issueResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found." });
    }

    const updateMessage = message || `Status changed to ${status}`;
    await client.query(
      `
      INSERT INTO issue_updates (issue_id, message, created_by)
      VALUES ($1, $2, $3);
      `,
      [issueId, updateMessage, actorId],
    );

    await client.query("COMMIT");
    return res.json({ issue: issueResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleDbError(res, error);
  } finally {
    client.release();
  }
};
