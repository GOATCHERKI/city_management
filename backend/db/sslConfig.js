const LOCAL_HOST_PATTERNS = ["localhost", "127.0.0.1"];

const isLikelyLocalDatabase = (databaseUrl) => {
  const url = String(databaseUrl || "").toLowerCase();
  if (!url) return false;
  return LOCAL_HOST_PATTERNS.some(
    (host) => url.includes(`@${host}:`) || url.includes(`://${host}:`),
  );
};

export const resolveDbSslConfig = (databaseUrl) => {
  const mode = String(process.env.DB_SSL_MODE || "auto")
    .trim()
    .toLowerCase();

  if (mode === "disable" || mode === "off" || mode === "false") {
    return false;
  }

  if (mode === "require" || mode === "on" || mode === "true") {
    return { rejectUnauthorized: false };
  }

  if (isLikelyLocalDatabase(databaseUrl)) {
    return false;
  }

  return { rejectUnauthorized: false };
};
