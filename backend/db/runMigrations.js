import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import pg from "pg";
import { resolveDbSslConfig } from "./sslConfig.js";

dotenv.config();

const { Client } = pg;

const run = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing in backend/.env");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolveDbSslConfig(process.env.DATABASE_URL),
  });

  const schemaPath = path.resolve("db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  await client.connect();
  await client.query(schemaSql);
  console.log("Schema migration completed.");

  const runPostgis = process.argv.includes("--postgis");
  if (runPostgis) {
    const postgisPath = path.resolve("db", "postgis_upgrade.sql");
    const postgisSql = fs.readFileSync(postgisPath, "utf8");
    await client.query(postgisSql);
    console.log("PostGIS migration completed.");
  }

  const tables = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name;`,
  );

  console.log("Tables in public schema:");
  for (const row of tables.rows) {
    console.log(`- ${row.table_name}`);
  }

  await client.end();
};

run().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
