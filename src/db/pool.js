import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

const pool = new Pool(config.db);

pool.on("error", (err) => {
  console.error("Error inesperado en el pool de PostgreSQL:", err);
});

/**
 * Ejecuta una query con parámetros.
 * @param {string} text - SQL con placeholders $1, $2, ...
 * @param {any[]} [params] - Valores para los placeholders
 */
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (config.nodeEnv === "development" && duration > 100) {
    console.log("Query lenta:", { text: text.slice(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

export function getPool() {
  return pool;
}

/** Cierra el pool (llamar al cerrar la app) */
export async function closePool() {
  await pool.end();
}
