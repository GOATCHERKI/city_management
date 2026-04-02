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
  const estimatedCost =
    body.estimated_cost === null ||
    body.estimated_cost === undefined ||
    body.estimated_cost === ""
      ? null
      : Number(body.estimated_cost);
  const budgetId =
    body.budget_id === null ||
    body.budget_id === undefined ||
    body.budget_id === ""
      ? null
      : Number(body.budget_id);

  return {
    title,
    description,
    category,
    photoUrl: photoUrl || null,
    estimatedCost,
    budgetId,
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
    const mimeType = req.file.mimetype || "application/octet-stream";
    const base64Payload = req.file.buffer.toString("base64");
    const imageDataUri = `data:${mimeType};base64,${base64Payload}`;
    const originalName = String(req.file.originalname || "issue-image")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 120);

    const result = await imagekit.files.upload({
      file: imageDataUri,
      fileName: `issue-${Date.now()}-${originalName}`,
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
      INSERT INTO issues (
        title, description, category, latitude, longitude,
        photo_url, created_by, estimated_cost, budget_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, title, description, category, latitude, longitude, status,
                created_by, assigned_department, photo_url, estimated_cost,
                final_cost, budget_id, resolved_at, created_at, updated_at;
    `;

    const values = [
      payload.title,
      payload.description,
      payload.category,
      payload.latitude,
      payload.longitude,
      payload.photoUrl,
      userId,
      payload.estimatedCost,
      payload.budgetId,
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
              i.status, i.photo_url, i.assigned_department, i.estimated_cost,
              i.final_cost, i.budget_id, i.resolved_at, i.created_at, i.updated_at,
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

  if (requesterRole === "staff" || requesterRole === "dept_admin") {
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
              i.estimated_cost, i.final_cost, i.budget_id, i.resolved_at,
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

export const getIssueDetails = async (req, res) => {
  const issueId = Number(req.validated?.params?.id ?? req.params.id);
  const requesterRole = String(req.user?.role || "").toLowerCase();
  const requesterId = Number(req.user?.id);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({ message: "Invalid issue id." });
  }

  try {
    const issueResult = await pool.query(
      `
      SELECT i.id, i.title, i.description, i.category, i.latitude, i.longitude,
             i.status, i.photo_url, i.created_by, i.assigned_department,
              i.estimated_cost, i.final_cost, i.budget_id, i.resolved_at,
              i.created_at, i.updated_at,
             d.name AS assigned_department_name,
             u.full_name AS created_by_name,
             u.cid AS created_by_cid
      FROM issues i
      LEFT JOIN departments d ON d.id = i.assigned_department
      LEFT JOIN users u ON u.id = i.created_by
      WHERE i.id = $1
      LIMIT 1;
      `,
      [issueId],
    );

    if (!issueResult.rowCount) {
      return res.status(404).json({ message: "Issue not found." });
    }

    const issue = issueResult.rows[0];

    if (requesterRole === "staff" || requesterRole === "dept_admin") {
      if (!Number.isInteger(requesterId) || requesterId <= 0) {
        return res.status(401).json({ message: "Invalid auth token payload." });
      }

      const userResult = await pool.query(
        "SELECT department_id FROM users WHERE id = $1 LIMIT 1",
        [requesterId],
      );
      const staffDepartmentId = userResult.rows[0]?.department_id;

      if (
        !staffDepartmentId ||
        Number(staffDepartmentId) !== Number(issue.assigned_department)
      ) {
        return res
          .status(403)
          .json({ message: "You are not allowed to view this issue." });
      }
    }

    const updatesResult = await pool.query(
      `
            SELECT iu.id, iu.issue_id, iu.message, iu.photo_url, iu.cost_added,
              iu.created_by, iu.created_at,
             u.full_name AS created_by_name,
             u.cid AS created_by_cid,
             u.role AS created_by_role
      FROM issue_updates iu
      LEFT JOIN users u ON u.id = iu.created_by
      WHERE iu.issue_id = $1
      ORDER BY iu.created_at DESC;
      `,
      [issueId],
    );

    return res.json({
      issue,
      updates: updatesResult.rows,
    });
  } catch (error) {
    return handleDbError(res, error);
  }
};

export const assignIssueToDepartment = async (req, res) => {
  const issueId = Number(req.params.id);
  const departmentId = Number(req.body.departmentId);
  const estimatedCost =
    req.body.estimatedCost === null ||
    req.body.estimatedCost === undefined ||
    req.body.estimatedCost === ""
      ? null
      : Number(req.body.estimatedCost);
  const budgetId =
    req.body.budgetId === null ||
    req.body.budgetId === undefined ||
    req.body.budgetId === ""
      ? null
      : Number(req.body.budgetId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({ message: "Invalid issue id." });
  }

  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return res
      .status(400)
      .json({ message: "departmentId must be a positive integer." });
  }

  if (
    estimatedCost !== null &&
    (!Number.isFinite(estimatedCost) || estimatedCost < 0)
  ) {
    return res.status(400).json({
      message: "estimatedCost must be a non-negative number.",
    });
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

    const existingIssueResult = await client.query(
      `
      SELECT id, assigned_department, budget_id, estimated_cost, final_cost
      FROM issues
      WHERE id = $1
      LIMIT 1
      FOR UPDATE;
      `,
      [issueId],
    );

    if (!existingIssueResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Issue not found." });
    }

    const existingIssue = existingIssueResult.rows[0];
    const nextBudgetId = budgetId !== null ? budgetId : existingIssue.budget_id;
    const nextEstimatedCost =
      estimatedCost !== null ? estimatedCost : existingIssue.estimated_cost;

    if (nextBudgetId !== null) {
      const budgetResult = await client.query(
        `
        SELECT id
        FROM budgets
        WHERE id = $1 AND department_id = $2
        LIMIT 1;
        `,
        [nextBudgetId, departmentId],
      );
      if (!budgetResult.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "budgetId is invalid for the selected department.",
        });
      }
    }

    const currentReservedCost = Number(
      existingIssue.final_cost ?? existingIssue.estimated_cost ?? 0,
    );
    const nextReservedCost = Number(
      existingIssue.final_cost ?? nextEstimatedCost ?? 0,
    );
    const currentBudgetId = existingIssue.budget_id
      ? Number(existingIssue.budget_id)
      : null;
    const nextBudgetIdNumber = nextBudgetId ? Number(nextBudgetId) : null;

    if (
      currentBudgetId &&
      nextBudgetIdNumber &&
      currentBudgetId === nextBudgetIdNumber
    ) {
      const delta = nextReservedCost - currentReservedCost;
      if (delta !== 0) {
        await client.query(
          `
          UPDATE budgets
          SET used_amount = GREATEST(used_amount + $1, 0),
              updated_at = NOW()
          WHERE id = $2;
          `,
          [delta, currentBudgetId],
        );
      }
    } else {
      if (currentBudgetId && currentReservedCost > 0) {
        await client.query(
          `
          UPDATE budgets
          SET used_amount = GREATEST(used_amount - $1, 0),
              updated_at = NOW()
          WHERE id = $2;
          `,
          [currentReservedCost, currentBudgetId],
        );
      }

      if (nextBudgetIdNumber && nextReservedCost > 0) {
        await client.query(
          `
          UPDATE budgets
          SET used_amount = used_amount + $1,
              updated_at = NOW()
          WHERE id = $2;
          `,
          [nextReservedCost, nextBudgetIdNumber],
        );
      }
    }

    const issueResult = await client.query(
      `
      UPDATE issues
      SET assigned_department = $1,
          estimated_cost = $2,
          budget_id = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING id, title, status, assigned_department, estimated_cost,
                budget_id, updated_at;
      `,
      [departmentId, nextEstimatedCost, nextBudgetId, issueId],
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

export const updateIssueStatus = async (req, res) => {
  const issueId = Number(req.params.id);
  const status = String(req.body.status || "").trim();
  const message = req.body.message ? String(req.body.message).trim() : null;
  const costAdded =
    req.body.cost_added === null ||
    req.body.cost_added === undefined ||
    req.body.cost_added === ""
      ? 0
      : Number(req.body.cost_added);
  const photoUrl = req.body.photo_url
    ? String(req.body.photo_url).trim()
    : null;
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

  if (!Number.isFinite(costAdded) || costAdded < 0) {
    return res.status(400).json({
      message: "cost_added must be a non-negative number.",
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
      RETURNING id, title, status, assigned_department, budget_id,
                estimated_cost, final_cost, resolved_at, updated_at;
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
      INSERT INTO issue_updates (issue_id, message, created_by, photo_url, cost_added)
      VALUES ($1, $2, $3, $4, $5);
      `,
      [issueId, updateMessage, actorId, photoUrl, costAdded || null],
    );

    if (status === "resolved") {
      const costResult = await client.query(
        `
        SELECT COALESCE(SUM(cost_added), 0)::numeric AS total_cost
        FROM issue_updates
        WHERE issue_id = $1;
        `,
        [issueId],
      );
      const finalCost = Number(costResult.rows[0]?.total_cost || 0);
      const priorAccountedCost = Number(
        issueResult.rows[0].final_cost ??
          issueResult.rows[0].estimated_cost ??
          0,
      );
      const budgetDelta = finalCost - priorAccountedCost;

      if (issueResult.rows[0].budget_id && budgetDelta !== 0) {
        await client.query(
          `
          UPDATE budgets
          SET used_amount = GREATEST(used_amount + $1, 0),
              updated_at = NOW()
          WHERE id = $2;
          `,
          [budgetDelta, issueResult.rows[0].budget_id],
        );
      }

      const finalIssueResult = await client.query(
        `
        UPDATE issues
        SET final_cost = $1,
            resolved_at = COALESCE(resolved_at, NOW()),
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, title, status, assigned_department, budget_id,
                  estimated_cost, final_cost, resolved_at, updated_at;
        `,
        [finalCost, issueId],
      );

      await client.query("COMMIT");
      return res.json({ issue: finalIssueResult.rows[0] });
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
