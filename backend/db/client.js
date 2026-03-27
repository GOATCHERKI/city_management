import dotenv from "dotenv";
import pg from "pg";
import { resolveDbSslConfig } from "./sslConfig.js";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in backend/.env");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveDbSslConfig(process.env.DATABASE_URL),
});

export default pool;
