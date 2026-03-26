import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";
process.env.MAIN_ADMIN_CID = process.env.MAIN_ADMIN_CID || "admin1";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@localhost:5432/test";

const buildMockDb = () => {
  const state = {
    users: [
      {
        id: 1,
        cid: "admin1",
        full_name: "Main Admin",
        email: "admin@example.com",
        role: "admin",
        department_id: null,
        is_email_verified: true,
        created_at: new Date("2026-03-20T08:00:00.000Z"),
        updated_at: new Date("2026-03-20T08:00:00.000Z"),
      },
    ],
    logs: [],
    nextUserId: 2,
    nextLogId: 1,
  };

  const filterLogs = (sql, values) => {
    let index = 0;
    let actorUserId = null;
    let actorCid = null;
    let action = null;
    let from = null;
    let to = null;

    if (sql.includes("a.actor_user_id =")) {
      actorUserId = Number(values[index]);
      index += 1;
    }

    if (sql.includes("lower(a.actor_cid) =")) {
      actorCid = String(values[index] || "").toLowerCase();
      index += 1;
    }

    if (sql.includes("a.action =")) {
      action = String(values[index] || "");
      index += 1;
    }

    if (sql.includes("a.created_at >=")) {
      from = new Date(`${values[index]}T00:00:00.000Z`);
      index += 1;
    }

    if (sql.includes("a.created_at < (")) {
      to = new Date(`${values[index]}T00:00:00.000Z`);
      to.setUTCDate(to.getUTCDate() + 1);
      index += 1;
    }

    let logs = state.logs.filter((entry) => {
      if (actorUserId && Number(entry.actor_user_id) !== actorUserId)
        return false;
      if (actorCid && String(entry.actor_cid || "").toLowerCase() !== actorCid)
        return false;
      if (action && String(entry.action) !== action) return false;

      const createdAt = new Date(entry.created_at);
      if (from && createdAt < from) return false;
      if (to && createdAt >= to) return false;
      return true;
    });

    logs = logs.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return { logs, index };
  };

  const client = {
    query: async (sqlText, params = []) => {
      const sql = String(sqlText).replace(/\s+/g, " ").trim().toLowerCase();

      if (
        sql.startsWith("begin") ||
        sql.startsWith("commit") ||
        sql.startsWith("rollback")
      ) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("insert into users")) {
        const [cid, fullName, email, _passwordHash, role, departmentId] =
          params;
        const now = new Date();
        const user = {
          id: state.nextUserId,
          cid,
          full_name: fullName,
          email,
          role,
          is_email_verified: true,
          department_id: departmentId,
          created_at: now,
          updated_at: now,
        };
        state.nextUserId += 1;
        state.users.push(user);

        return {
          rowCount: 1,
          rows: [
            {
              id: user.id,
              cid: user.cid,
              full_name: user.full_name,
              email: user.email,
              role: user.role,
              is_email_verified: user.is_email_verified,
              department_id: user.department_id,
              created_at: user.created_at,
            },
          ],
        };
      }

      if (
        sql.includes(
          "select id, role, department_id from users where id = $1 limit 1",
        )
      ) {
        const userId = Number(params[0]);
        const user = state.users.find((item) => item.id === userId);

        if (!user) return { rowCount: 0, rows: [] };
        return {
          rowCount: 1,
          rows: [
            { id: user.id, role: user.role, department_id: user.department_id },
          ],
        };
      }

      if (sql.includes("update users set role = $1")) {
        const [role, departmentId, userId] = params;
        const user = state.users.find((item) => item.id === Number(userId));
        user.role = role;
        user.department_id = departmentId;
        user.updated_at = new Date();

        return {
          rowCount: 1,
          rows: [
            {
              id: user.id,
              cid: user.cid,
              full_name: user.full_name,
              email: user.email,
              role: user.role,
              department_id: user.department_id,
              updated_at: user.updated_at,
            },
          ],
        };
      }

      if (sql.includes("update users set department_id = $1")) {
        const [departmentId, userId] = params;
        const user = state.users.find((item) => item.id === Number(userId));
        user.department_id = departmentId;
        user.updated_at = new Date();

        return {
          rowCount: 1,
          rows: [
            {
              id: user.id,
              cid: user.cid,
              full_name: user.full_name,
              role: user.role,
              department_id: user.department_id,
              updated_at: user.updated_at,
            },
          ],
        };
      }

      if (sql.includes("insert into admin_audit_logs")) {
        const [
          actorUserId,
          actorCidValue,
          targetUserId,
          actionValue,
          oldValues,
          newValues,
          ipAddress,
          userAgent,
        ] = params;

        const entry = {
          id: state.nextLogId,
          actor_user_id: actorUserId,
          actor_cid: actorCidValue,
          target_user_id: targetUserId,
          action: actionValue,
          old_values: oldValues ? JSON.parse(oldValues) : null,
          new_values: newValues ? JSON.parse(newValues) : null,
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: new Date(),
        };

        state.nextLogId += 1;
        state.logs.push(entry);

        return { rowCount: 1, rows: [] };
      }

      throw new Error(`Unhandled transactional SQL in test mock: ${sql}`);
    },
    release: () => {},
  };

  const query = async (sqlText, params = []) => {
    const sql = String(sqlText).replace(/\s+/g, " ").trim().toLowerCase();

    if (sql.includes("select count(*)::int as total from admin_audit_logs a")) {
      const { logs } = filterLogs(sql, params);
      return {
        rowCount: 1,
        rows: [{ total: logs.length }],
      };
    }

    if (sql.includes("select a.id, a.actor_user_id, a.actor_cid")) {
      const { logs, index } = filterLogs(sql, params);
      const limit = Number(params[index]);
      const offset = Number(params[index + 1]);
      const sliced = logs.slice(offset, offset + limit).map((entry) => {
        const target = state.users.find(
          (item) => item.id === entry.target_user_id,
        );
        return {
          ...entry,
          target_cid: target?.cid || null,
        };
      });

      return {
        rowCount: sliced.length,
        rows: sliced,
      };
    }

    if (sql.includes("select u.id, u.cid, u.full_name")) {
      return {
        rowCount: state.users.length,
        rows: state.users.map((user) => ({
          id: user.id,
          cid: user.cid,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          is_email_verified: user.is_email_verified,
          department_id: user.department_id,
          created_at: user.created_at,
          department_name: null,
        })),
      };
    }

    throw new Error(`Unhandled SQL in test mock: ${sql}`);
  };

  return {
    state,
    connect: async () => client,
    query,
  };
};

let app;
let pool;
let restorePool;
let db;

const adminToken = jwt.sign(
  { id: 1, cid: "admin1", role: "admin", email: "admin@example.com" },
  process.env.JWT_SECRET,
);

test.before(async () => {
  ({ default: pool } = await import("../db/client.js"));
  ({ app } = await import("../app.js"));
});

test.beforeEach(() => {
  db = buildMockDb();

  const originalConnect = pool.connect;
  const originalQuery = pool.query;

  pool.connect = db.connect;
  pool.query = db.query;

  restorePool = () => {
    pool.connect = originalConnect;
    pool.query = originalQuery;
  };
});

test.afterEach(() => {
  restorePool();
});

test("POST /api/admin/users creates user and writes audit log", async () => {
  const response = await request(app)
    .post("/api/admin/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      cid: "staff100",
      fullName: "Test Staff",
      email: "staff100@example.com",
      password: "StrongPass123",
      role: "staff",
      departmentId: 2,
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.cid, "staff100");

  assert.equal(db.state.users.length, 2);
  assert.equal(db.state.logs.length, 1);
  assert.equal(db.state.logs[0].action, "user.create");
  assert.equal(db.state.logs[0].target_user_id, response.body.user.id);
});

test("PATCH /api/admin/users/:id/role updates role and records audit", async () => {
  const created = await request(app)
    .post("/api/admin/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      cid: "staff200",
      fullName: "Staff Two",
      email: "staff200@example.com",
      password: "StrongPass123",
      role: "staff",
      departmentId: 1,
    });

  const userId = created.body.user.id;

  const response = await request(app)
    .patch(`/api/admin/users/${userId}/role`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ role: "citizen", departmentId: null });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.role, "citizen");

  const roleAudit = db.state.logs.find(
    (entry) => entry.action === "user.role.update",
  );
  assert.ok(roleAudit);
  assert.equal(roleAudit.old_values.role, "staff");
  assert.equal(roleAudit.new_values.role, "citizen");
});

test("PATCH /api/admin/users/:id/department updates department and records audit", async () => {
  const created = await request(app)
    .post("/api/admin/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      cid: "staff300",
      fullName: "Staff Three",
      email: "staff300@example.com",
      password: "StrongPass123",
      role: "staff",
      departmentId: 1,
    });

  const userId = created.body.user.id;

  const response = await request(app)
    .patch(`/api/admin/users/${userId}/department`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ departmentId: 3 });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.department_id, 3);

  const departmentAudit = db.state.logs.find(
    (entry) => entry.action === "user.department.update",
  );
  assert.ok(departmentAudit);
  assert.equal(departmentAudit.old_values.departmentId, 1);
  assert.equal(departmentAudit.new_values.departmentId, 3);
});

test("GET /api/admin/audit-logs returns pagination metadata", async () => {
  for (let index = 0; index < 3; index += 1) {
    await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        cid: `staff-${index}`,
        fullName: `Staff ${index}`,
        email: `staff-${index}@example.com`,
        password: "StrongPass123",
        role: "staff",
        departmentId: 1,
      });
  }

  const response = await request(app)
    .get("/api/admin/audit-logs?limit=2&offset=1")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 3);
  assert.equal(response.body.limit, 2);
  assert.equal(response.body.offset, 1);
  assert.equal(Array.isArray(response.body.logs), true);
  assert.equal(response.body.logs.length, 2);
});

test("GET /api/admin/audit-logs exports CSV with audit rows", async () => {
  await request(app)
    .post("/api/admin/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      cid: "staff-csv",
      fullName: "CSV Staff",
      email: "staff-csv@example.com",
      password: "StrongPass123",
      role: "staff",
      departmentId: 2,
    });

  const response = await request(app)
    .get("/api/admin/audit-logs?format=csv&limit=25&offset=0")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/csv/);
  assert.match(response.headers["content-disposition"], /admin-audit-logs-/);

  const csvBody = response.text;
  assert.ok(csvBody.startsWith("\uFEFFsep=,"));
  assert.match(csvBody, /old_role/);
  assert.match(csvBody, /new_role/);
  assert.match(csvBody, /user\.create/);
});

test("GET /api/admin/audit-logs filters correctly by from/to date range", async () => {
  db.state.logs = [
    {
      id: 1,
      actor_user_id: 1,
      actor_cid: "admin1",
      target_user_id: 1,
      action: "user.create",
      old_values: null,
      new_values: { role: "staff", departmentId: 1 },
      ip_address: "::1",
      user_agent: "test-agent",
      created_at: new Date("2026-03-25T09:00:00.000Z"),
    },
    {
      id: 2,
      actor_user_id: 1,
      actor_cid: "admin1",
      target_user_id: 1,
      action: "user.role.update",
      old_values: { role: "staff", departmentId: 1 },
      new_values: { role: "citizen", departmentId: null },
      ip_address: "::1",
      user_agent: "test-agent",
      created_at: new Date("2026-03-26T10:00:00.000Z"),
    },
    {
      id: 3,
      actor_user_id: 1,
      actor_cid: "admin1",
      target_user_id: 1,
      action: "user.department.update",
      old_values: { role: "staff", departmentId: 1 },
      new_values: { role: "staff", departmentId: 3 },
      ip_address: "::1",
      user_agent: "test-agent",
      created_at: new Date("2026-03-27T11:00:00.000Z"),
    },
  ];

  const response = await request(app)
    .get(
      "/api/admin/audit-logs?from=2026-03-26&to=2026-03-26&limit=25&offset=0",
    )
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.offset, 0);
  assert.equal(response.body.logs.length, 1);
  assert.equal(response.body.logs[0].action, "user.role.update");
  assert.equal(response.body.logs[0].target_cid, "admin1");
});
