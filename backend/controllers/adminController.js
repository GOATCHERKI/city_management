import bcrypt from "bcryptjs";
import pool from "../db/client.js";

const MAIN_ADMIN_CID = String(process.env.MAIN_ADMIN_CID || "")
  .trim()
  .toLowerCase();

const getAuditContext = (req) => ({
  actorUserId: Number.isInteger(Number(req.user?.id))
    ? Number(req.user.id)
    : null,
  actorCid:
    String(req.user?.cid || "")
      .trim()
      .toLowerCase() || null,
  ipAddress: req.ip || null,
  userAgent: String(req.headers["user-agent"] || "") || null,
});

const insertAuditLog = async (
  client,
  { actor, targetUserId, action, oldValues, newValues },
) => {
  await client.query(
    `
    INSERT INTO admin_audit_logs (
      actor_user_id,
      actor_cid,
      target_user_id,
      action,
      old_values,
      new_values,
      ip_address,
      user_agent
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::inet, $8);
    `,
    [
      actor.actorUserId,
      actor.actorCid,
      targetUserId,
      action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      actor.ipAddress,
      actor.userAgent,
    ],
  );
};

const isMainAdmin = (req) => {
  if (String(req.user?.role || "").toLowerCase() !== "admin") {
    return false;
  }

  if (!MAIN_ADMIN_CID) {
    return false;
  }

  return (
    String(req.user?.cid || "")
      .trim()
      .toLowerCase() === MAIN_ADMIN_CID
  );
};

const normalizeUserInput = (body) => ({
  cid: String(body.cid || "")
    .trim()
    .toLowerCase(),
  fullName: String(body.fullName || "").trim(),
  email: String(body.email || "")
    .trim()
    .toLowerCase(),
  password: String(body.password || ""),
  role: String(body.role || "citizen")
    .trim()
    .toLowerCase(),
  departmentId:
    body.departmentId === null ||
    body.departmentId === undefined ||
    body.departmentId === ""
      ? null
      : Number(body.departmentId),
});

const handleAdminDbError = (res, error) => {
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

  if (error?.code === "23503") {
    return res.status(400).json({ message: "Invalid department reference." });
  }

  console.error("Admin controller DB error:", error);
  return res.status(500).json({ message: "Internal server error" });
};

export const listUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT u.id, u.cid, u.full_name, u.email, u.role, u.is_email_verified,
             u.department_id, u.created_at, d.name AS department_name
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      ORDER BY u.created_at DESC;
      `,
    );

    return res.json({ users: result.rows });
  } catch (error) {
    return handleAdminDbError(res, error);
  }
};

export const createUserByAdmin = async (req, res) => {
  const input = normalizeUserInput(req.body || {});
  const actor = getAuditContext(req);

  if (input.role === "admin" && !isMainAdmin(req)) {
    return res.status(403).json({
      message: "Only main admin can create admin users.",
    });
  }

  if (input.role === "staff" && !Number.isInteger(input.departmentId)) {
    return res.status(400).json({
      message: "departmentId is required when creating a staff user.",
    });
  }

  const client = await pool.connect();

  try {
    const passwordHash = await bcrypt.hash(input.password, 10);

    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO users (
        cid,
        full_name,
        email,
        password_hash,
        role,
        is_email_verified,
        department_id,
        verification_token_hash,
        verification_expires_at
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, $6, NULL, NULL)
      RETURNING id, cid, full_name, email, role, is_email_verified, department_id, created_at;
      `,
      [
        input.cid,
        input.fullName,
        input.email,
        passwordHash,
        input.role,
        input.role === "staff" ? input.departmentId : null,
      ],
    );

    await insertAuditLog(client, {
      actor,
      targetUserId: result.rows[0].id,
      action: "user.create",
      oldValues: null,
      newValues: {
        cid: result.rows[0].cid,
        role: result.rows[0].role,
        departmentId: result.rows[0].department_id,
      },
    });

    await client.query("COMMIT");

    return res.status(201).json({
      message: "User created successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminDbError(res, error);
  } finally {
    client.release();
  }
};

export const updateUserRole = async (req, res) => {
  const actor = getAuditContext(req);
  const userId = Number(req.validated?.params?.id ?? req.params.id);
  const nextRole = String(req.body?.role || "")
    .trim()
    .toLowerCase();
  const departmentId =
    req.body?.departmentId === null ||
    req.body?.departmentId === undefined ||
    req.body?.departmentId === ""
      ? null
      : Number(req.body.departmentId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid user id." });
  }

  if (nextRole === "admin" && !isMainAdmin(req)) {
    return res.status(403).json({
      message: "Only main admin can grant admin role.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      "SELECT id, role, department_id FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );

    if (!currentResult.rowCount) {
      return res.status(404).json({ message: "User not found." });
    }

    const currentUser = currentResult.rows[0];

    if (
      currentUser.role === "admin" &&
      nextRole !== "admin" &&
      !isMainAdmin(req)
    ) {
      return res.status(403).json({
        message: "Only main admin can demote admin users.",
      });
    }

    if (
      nextRole === "staff" &&
      !Number.isInteger(departmentId) &&
      !currentUser.department_id
    ) {
      return res.status(400).json({
        message: "departmentId is required when changing role to staff.",
      });
    }

    const resolvedDepartmentId =
      nextRole === "staff"
        ? Number.isInteger(departmentId)
          ? departmentId
          : currentUser.department_id
        : null;

    const result = await client.query(
      `
      UPDATE users
      SET role = $1,
          department_id = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, cid, full_name, email, role, department_id, updated_at;
      `,
      [nextRole, resolvedDepartmentId, userId],
    );

    await insertAuditLog(client, {
      actor,
      targetUserId: userId,
      action: "user.role.update",
      oldValues: {
        role: currentUser.role,
        departmentId: currentUser.department_id,
      },
      newValues: {
        role: result.rows[0].role,
        departmentId: result.rows[0].department_id,
      },
    });

    await client.query("COMMIT");

    return res.json({
      message: "User role updated successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminDbError(res, error);
  } finally {
    client.release();
  }
};

export const updateUserDepartment = async (req, res) => {
  const actor = getAuditContext(req);
  const userId = Number(req.validated?.params?.id ?? req.params.id);
  const departmentId =
    req.body?.departmentId === null ||
    req.body?.departmentId === undefined ||
    req.body?.departmentId === ""
      ? null
      : Number(req.body.departmentId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid user id." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      "SELECT id, role, department_id FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );

    if (!userResult.rowCount) {
      return res.status(404).json({ message: "User not found." });
    }

    if (userResult.rows[0].role !== "staff") {
      return res.status(400).json({
        message: "Only staff users can be assigned to departments.",
      });
    }

    const result = await client.query(
      `
      UPDATE users
      SET department_id = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, cid, full_name, role, department_id, updated_at;
      `,
      [departmentId, userId],
    );

    await insertAuditLog(client, {
      actor,
      targetUserId: userId,
      action: "user.department.update",
      oldValues: {
        role: userResult.rows[0].role,
        departmentId: userResult.rows[0].department_id,
      },
      newValues: {
        role: result.rows[0].role,
        departmentId: result.rows[0].department_id,
      },
    });

    await client.query("COMMIT");

    return res.json({
      message: "Staff department updated successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleAdminDbError(res, error);
  } finally {
    client.release();
  }
};

export const listAdminAuditLogs = async (req, res) => {
  const isRequesterMainAdmin = isMainAdmin(req);
  const requesterId = Number(req.user?.id);

  const query = req.validated?.query || req.query || {};
  const limit = Number(query.limit || 50);
  const offset = Number(query.offset || 0);
  const actorCid = query.actorCid
    ? String(query.actorCid).trim().toLowerCase()
    : null;
  const action = query.action ? String(query.action).trim() : null;
  const from = query.from ? String(query.from) : null;
  const to = query.to ? String(query.to) : null;
  const format = query.format
    ? String(query.format).trim().toLowerCase()
    : "json";

  const conditions = [];
  const values = [];

  if (
    !isRequesterMainAdmin &&
    Number.isInteger(requesterId) &&
    requesterId > 0
  ) {
    values.push(requesterId);
    conditions.push(`a.actor_user_id = $${values.length}`);
  }

  if (actorCid) {
    values.push(actorCid);
    conditions.push(`LOWER(a.actor_cid) = $${values.length}`);
  }

  if (action) {
    values.push(action);
    conditions.push(`a.action = $${values.length}`);
  }

  if (from) {
    values.push(from);
    conditions.push(`a.created_at >= $${values.length}::date`);
  }

  if (to) {
    values.push(to);
    conditions.push(
      `a.created_at < ($${values.length}::date + INTERVAL '1 day')`,
    );
  }

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const baseQuery = `
      SELECT a.id, a.actor_user_id, a.actor_cid, a.target_user_id, a.action,
             a.old_values, a.new_values, a.ip_address, a.user_agent, a.created_at,
             target.cid AS target_cid
      FROM admin_audit_logs a
      LEFT JOIN users target ON target.id = a.target_user_id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder};
    `;

    const result = await pool.query(baseQuery, values);

    if (format === "csv") {
      const normalizeObject = (value) => {
        if (!value) return null;
        if (typeof value === "object") return value;
        if (typeof value !== "string") return null;
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      };

      const csvEscape = (value) => {
        if (value === null || value === undefined) return "";
        const raw = String(value)
          .replace(/\r\n/g, "\\n")
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\n");
        const escaped = raw.replace(/"/g, '""');
        return `"${escaped}"`;
      };

      const serializeCsvRow = (items) => items.map(csvEscape).join(",");

      const headers = [
        "id",
        "created_at",
        "action",
        "actor_user_id",
        "actor_cid",
        "target_user_id",
        "target_cid",
        "old_role",
        "old_department_id",
        "new_role",
        "new_department_id",
        "old_values_json",
        "new_values_json",
        "ip_address",
        "user_agent",
      ];

      const lines = ["sep=,", serializeCsvRow(headers)];
      for (const row of result.rows) {
        const oldValues = normalizeObject(row.old_values);
        const newValues = normalizeObject(row.new_values);
        const oldRole = oldValues?.role ?? "";
        const oldDepartmentId = oldValues?.departmentId ?? "";
        const newRole = newValues?.role ?? "";
        const newDepartmentId = newValues?.departmentId ?? "";

        lines.push(
          serializeCsvRow([
            row.id,
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : row.created_at,
            row.action,
            row.actor_user_id,
            row.actor_cid,
            row.target_user_id,
            row.target_cid,
            oldRole,
            oldDepartmentId,
            newRole,
            newDepartmentId,
            oldValues ? JSON.stringify(oldValues) : "",
            newValues ? JSON.stringify(newValues) : "",
            row.ip_address,
            row.user_agent,
          ]),
        );
      }

      return res
        .status(200)
        .setHeader("Content-Type", "text/csv; charset=utf-8")
        .setHeader(
          "Content-Disposition",
          `attachment; filename="admin-audit-logs-${Date.now()}.csv"`,
        )
        .send(`\uFEFF${lines.join("\r\n")}`);
    }

    return res.json({ logs: result.rows });
  } catch (error) {
    return handleAdminDbError(res, error);
  }
};
