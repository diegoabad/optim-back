import dotenv from "dotenv";

dotenv.config();

/** Configuración para PostgreSQL: DATABASE_URL o variables sueltas (local/remoto) */
function getDbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      // Supabase y otros clouds requieren SSL
      ssl: process.env.DATABASE_SSL !== "false" ? { rejectUnauthorized: false } : false,
    };
  }
  return {
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT, 10) || 5432,
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    database: process.env.PGDATABASE || "optima",
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

export const config = {
  port: parseInt(process.env.PORT, 10) || 4000,
  jwtSecret: process.env.JWT_SECRET || "clave-secreta-desarrollo-cambiar",
  nodeEnv: process.env.NODE_ENV || "development",
  db: getDbConfig(),
};
