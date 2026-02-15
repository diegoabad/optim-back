import { query } from "./pool.js";

let migrated = false;

export async function ensureMigration() {
  if (migrated) return;
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role VARCHAR(32) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  await query(`
    DO $$ BEGIN
      ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  await query(`
    DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await query(`
    DO $$ BEGIN
      ALTER TABLE users ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  await query(`
    DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'active', 'disabled'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`);
  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(32) NOT NULL CHECK (type IN ('pdp', 'poisson', 'cep')),
      payload JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type)`);
  await query(`
    CREATE TABLE IF NOT EXISTS repuestos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(8) NOT NULL CHECK (type IN ('ar', 'br')),
      name VARCHAR(255),
      image VARCHAR(255),
      payload JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_repuestos_user_id ON repuestos(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_repuestos_type ON repuestos(type)`);
  await query(`
    DO $$ BEGIN
      ALTER TABLE repuestos ADD COLUMN code VARCHAR(128);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  await query(`UPDATE repuestos SET code = 'REP-' || id::text WHERE code IS NULL`);
  migrated = true;
}

export async function updateUser(userId, { name, password } = {}) {
  await ensureMigration();
  if (name !== undefined) {
    await query("UPDATE users SET name = $1 WHERE id = $2", [name ?? null, userId]);
  }
  if (password !== undefined) {
    await query("UPDATE users SET password = $1 WHERE id = $2", [password, userId]);
  }
  return findUserById(userId);
}

export async function createUser(email, hashedPassword, name = null, role = "user", status = "pending") {
  await ensureMigration();
  const res = await query(
    "INSERT INTO users (email, password, name, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [email, hashedPassword, name || null, role === "admin" ? "admin" : "user", status === "active" ? "active" : status === "disabled" ? "disabled" : "pending"]
  );
  return res.rows[0].id;
}

export async function findUserByEmail(email) {
  await ensureMigration();
  const res = await query("SELECT * FROM users WHERE email = $1", [email]);
  return res.rows[0] || null;
}

export async function findUserById(id) {
  await ensureMigration();
  const res = await query(
    "SELECT id, email, name, role, status, created_at FROM users WHERE id = $1",
    [id]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    ...row,
    status: row.status || "pending",
    created_at: row.created_at?.toISOString?.() ?? row.created_at,
  };
}

/** Devuelve el hash de contraseña del usuario (solo para verificación al cambiar contraseña). */
export async function getPasswordHash(userId) {
  await ensureMigration();
  const res = await query("SELECT password FROM users WHERE id = $1", [userId]);
  return res.rows[0]?.password ?? null;
}

/** Listar usuarios (admin). statusFilter: pending | active | disabled | activos (active+disabled) */
export async function findAllUsers(statusFilter = null) {
  await ensureMigration();
  let text = "SELECT id, email, name, role, status, created_at FROM users ORDER BY created_at DESC";
  const params = [];
  if (statusFilter === "activos") {
    text = "SELECT id, email, name, role, status, created_at FROM users WHERE status IN ('active', 'disabled') ORDER BY created_at DESC";
  } else if (statusFilter && ["pending", "active", "disabled"].includes(statusFilter)) {
    text = "SELECT id, email, name, role, status, created_at FROM users WHERE status = $1 ORDER BY created_at DESC";
    params.push(statusFilter);
  }
  const res = await query(text, params);
  return res.rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role || "user",
    status: row.status || "pending",
    created_at: row.created_at?.toISOString?.() ?? row.created_at,
  }));
}

/** Actualizar status de un usuario (admin). */
export async function updateUserStatus(userId, status) {
  await ensureMigration();
  if (!["pending", "active", "disabled"].includes(status)) return null;
  await query("UPDATE users SET status = $1 WHERE id = $2", [status, userId]);
  return findUserById(userId);
}

/** Eliminar un usuario (admin). No elimina al propio admin. */
export async function deleteUser(userId) {
  await ensureMigration();
  const res = await query("DELETE FROM users WHERE id = $1 RETURNING id", [userId]);
  return res.rows[0] ? { id: res.rows[0].id } : null;
}

// --- Projects (cálculos guardados) ---

export async function createProject(userId, { name, type, payload }) {
  await ensureMigration();
  const res = await query(
    `INSERT INTO projects (user_id, name, type, payload) VALUES ($1, $2, $3, $4) RETURNING id, name, type, payload, created_at, updated_at`,
    [userId, name, type, JSON.stringify(payload || {})]
  );
  return rowToProject(res.rows[0]);
}

export async function findProjectsByUserId(userId, type = null) {
  await ensureMigration();
  let text = "SELECT id, name, type, payload, created_at, updated_at FROM projects WHERE user_id = $1";
  const params = [userId];
  if (type) {
    text += " AND type = $2";
    params.push(type);
  }
  text += " ORDER BY updated_at DESC";
  const res = await query(text, params);
  return res.rows.map(rowToProject);
}

export async function findProjectByIdAndUser(projectId, userId) {
  await ensureMigration();
  const res = await query(
    "SELECT id, name, type, payload, created_at, updated_at FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, userId]
  );
  const row = res.rows[0];
  return row ? rowToProject(row) : null;
}

export async function updateProject(projectId, userId, { name, payload } = {}) {
  await ensureMigration();
  const current = await findProjectByIdAndUser(projectId, userId);
  if (!current) return null;
  const updates = [];
  const params = [];
  let i = 1;
  if (name !== undefined) {
    updates.push(`name = $${i++}`);
    params.push(name);
  }
  if (payload !== undefined) {
    updates.push(`payload = $${i++}`);
    params.push(JSON.stringify(payload));
  }
  if (updates.length === 0) return current;
  updates.push("updated_at = NOW()");
  params.push(projectId, userId);
  await query(
    `UPDATE projects SET ${updates.join(", ")} WHERE id = $${i} AND user_id = $${i + 1}`,
    params
  );
  return findProjectByIdAndUser(projectId, userId);
}

export async function deleteProject(projectId, userId) {
  await ensureMigration();
  const res = await query("DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id", [projectId, userId]);
  return res.rowCount > 0;
}

function rowToProject(row) {
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    payload,
    created_at: row.created_at?.toISOString?.() ?? row.created_at,
    updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

// --- Repuestos (ítems / materiales: AR = PDP, BR = Poisson) ---

export async function createRepuesto(userId, { type, code, name, image, payload }) {
  await ensureMigration();
  const res = await query(
    `INSERT INTO repuestos (user_id, type, code, name, image, payload) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, type, code, name, image, payload, created_at, updated_at`,
    [userId, type, (code != null && String(code).trim()) ? String(code).trim() : null, name ?? null, image ?? null, JSON.stringify(payload || {})]
  );
  return rowToRepuesto(res.rows[0]);
}

export async function findRepuestosByUserId(userId, type = null) {
  await ensureMigration();
  let text = "SELECT id, type, code, name, image, payload, created_at, updated_at FROM repuestos WHERE user_id = $1";
  const params = [userId];
  if (type) {
    text += " AND type = $2";
    params.push(type);
  }
  text += " ORDER BY updated_at DESC";
  const res = await query(text, params);
  return res.rows.map(rowToRepuesto);
}

export async function findRepuestoByIdAndUser(repuestoId, userId) {
  await ensureMigration();
  const res = await query(
    "SELECT id, type, code, name, image, payload, created_at, updated_at FROM repuestos WHERE id = $1 AND user_id = $2",
    [repuestoId, userId]
  );
  const row = res.rows[0];
  return row ? rowToRepuesto(row) : null;
}

export async function updateRepuesto(repuestoId, userId, { code, name, image, payload } = {}) {
  await ensureMigration();
  const current = await findRepuestoByIdAndUser(repuestoId, userId);
  if (!current) return null;
  const updates = [];
  const params = [];
  let i = 1;
  if (code !== undefined) {
    updates.push(`code = $${i++}`);
    params.push(code != null && String(code).trim() ? String(code).trim() : null);
  }
  if (name !== undefined) {
    updates.push(`name = $${i++}`);
    params.push(name ?? null);
  }
  if (image !== undefined) {
    updates.push(`image = $${i++}`);
    params.push(image ?? null);
  }
  if (payload !== undefined) {
    updates.push(`payload = $${i++}`);
    params.push(JSON.stringify(payload));
  }
  if (updates.length === 0) return current;
  updates.push("updated_at = NOW()");
  params.push(repuestoId, userId);
  await query(
    `UPDATE repuestos SET ${updates.join(", ")} WHERE id = $${i} AND user_id = $${i + 1}`,
    params
  );
  return findRepuestoByIdAndUser(repuestoId, userId);
}

export async function deleteRepuesto(repuestoId, userId) {
  await ensureMigration();
  const res = await query("DELETE FROM repuestos WHERE id = $1 AND user_id = $2 RETURNING id", [repuestoId, userId]);
  return res.rowCount > 0;
}

function rowToRepuesto(row) {
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
  return {
    id: row.id,
    type: row.type,
    code: row.code ?? null,
    name: row.name,
    image: row.image,
    payload,
    created_at: row.created_at?.toISOString?.() ?? row.created_at,
    updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}
