/**
 * Crea las tablas en Supabase (si no existen), añade columna role a users,
 * y crea un usuario admin y un usuario user.
 *
 * Ejecutar desde la raíz del proyecto api:
 *   node scripts/seed-supabase.js
 *
 * Requiere .env con DATABASE_URL apuntando a Supabase.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { ensureMigration, createUser, findUserByEmail, updateUserStatus } from "../src/db/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar .env desde la carpeta api (raíz del proyecto)
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const SEED_USERS = [
  {
    email: "admin@optima.local",
    password: "Admin123!",
    name: "Admin",
    role: "admin",
  },
  {
    email: "user@optima.local",
    password: "User123!",
    name: "Usuario",
    role: "user",
  },
];

async function main() {
  console.log("Conectando a la base de datos...");
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL en .env");
    process.exit(1);
  }

  try {
    console.log("Ejecutando migración (tablas + columna role)...");
    await ensureMigration();
    console.log("Migración lista.");

    for (const u of SEED_USERS) {
      const existing = await findUserByEmail(u.email);
      if (existing) {
        await updateUserStatus(existing.id, "active");
        console.log(`  Ya existe: ${u.email} (rol: ${existing.role || "user"}) — status actualizado a active.`);
        continue;
      }
      const hashed = await bcrypt.hash(u.password, 10);
      await createUser(u.email, hashed, u.name, u.role, "active");
      console.log(`  Creado: ${u.email} (rol: ${u.role}, status: active)`);
    }

    console.log("\nListo. Usuarios de prueba:");
    console.log("  Admin — email: admin@optima.local  contraseña: Admin123!");
    console.log("  User  — email: user@optima.local   contraseña: User123!");
  } catch (err) {
    console.error("Error:", err.message || err);
    process.exit(1);
  } finally {
    const { closePool } = await import("../src/db/pool.js");
    await closePool();
  }
}

main();
