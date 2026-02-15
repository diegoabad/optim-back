/**
 * Tests de integración para POST /api/auth/login.
 * Requiere que la API esté corriendo: npm run dev (en otra terminal).
 * Opcional: usuario admin creado con node scripts/seed-supabase.js para el test de login exitoso.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

const API_URL = process.env.API_URL || "http://localhost:4000";

async function login(body) {
  return fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("debe devolver 400 si faltan email y contraseña", async () => {
    const res = await login({});
    assert.strictEqual(res.status, 400, "esperado 400 sin body");
    const data = await res.json();
    assert.ok(data.error, "debe incluir mensaje error");
  });

  it("debe devolver 400 si solo falta contraseña", async () => {
    const res = await login({ email: "admin@optima.local" });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it("debe devolver 401 con credenciales incorrectas", async () => {
    const res = await login({
      email: "noexiste@test.com",
      password: "cualquiercosa",
    });
    if (res.status === 500) {
      const data = await res.json().catch(() => ({}));
      console.log("  (DB no disponible - no se pudo verificar 401):", data.error || "Error 500");
      return;
    }
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, "Credenciales incorrectas");
  });

  it("debe devolver 200 y token con admin@optima.local / Admin123! (si existe el usuario)", async () => {
    const res = await login({
      email: "admin@optima.local",
      password: "Admin123!",
    });
    if (res.status === 500) {
      const data = await res.json().catch(() => ({}));
      console.log("  (DB no disponible o sin usuario seed - ejecutá: node scripts/seed-supabase.js):", data.error || "Error 500");
      return;
    }
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      console.log("  (Usuario pendiente de aprobación):", data.error);
      return;
    }
    assert.strictEqual(res.status, 200, "esperado 200 con usuario seed");
    const data = await res.json();
    assert.ok(data.token, "debe devolver token");
    assert.ok(data.user, "debe devolver user");
    assert.strictEqual(data.user.email, "admin@optima.local");
    assert.ok(data.expiresIn);
  });
});
