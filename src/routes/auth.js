import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  getPasswordHash,
  updateUser,
} from "../db/database.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Validación básica de email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/auth/register
 * Body: { email, password, name? }
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Faltan campos requeridos",
        fields: { email: !email, password: !password },
      });
    }

    const emailNorm = String(email).trim().toLowerCase();
    if (!isValidEmail(emailNorm)) {
      return res.status(400).json({ error: "Email no válido" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    const existing = await findUserByEmail(emailNorm);
    if (existing) {
      return res.status(409).json({ error: "Ya existe un usuario con ese email" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userId = await createUser(emailNorm, hashedPassword, name ? String(name).trim() : null, "user", "pending");

    const user = await findUserById(userId);

    res.status(201).json({
      message: "Cuenta creada. Debe ser aprobada por un administrador para poder iniciar sesión.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "user",
        status: user.status || "pending",
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error("Error en registro:", err);
    res.status(500).json({ error: "Error al registrar el usuario" });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email y contraseña son requeridos",
      });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const user = await findUserByEmail(emailNorm);
    if (!user) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const userFull = await findUserById(user.id);
    if (userFull.status === "pending") {
      return res.status(403).json({ error: "Cuenta pendiente de aprobación por un administrador" });
    }
    if (userFull.status === "disabled") {
      return res.status(403).json({ error: "Cuenta deshabilitada" });
    }

    const token = jwt.sign(
      { userId: userFull.id },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Sesión iniciada",
      user: {
        id: userFull.id,
        email: userFull.email,
        name: userFull.name,
        role: userFull.role || "user",
        status: userFull.status || "active",
        created_at: userFull.created_at,
      },
      token,
      expiresIn: "7d",
    });
  } catch (err) {
    console.error("Error en login:", err);
    const message = config.nodeEnv === "development" && err?.message
      ? err.message
      : "Error al iniciar sesión";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/auth/me
 * Requiere Authorization: Bearer <token>
 * Devuelve el usuario actual.
 */
router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

/**
 * PATCH /api/auth/me
 * Body: { name?, currentPassword?, newPassword? }
 * Actualiza el perfil (nombre y/o contraseña). Para cambiar contraseña se requieren currentPassword y newPassword.
 */
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;

    if (newPassword != null && newPassword !== "") {
      if (!currentPassword) {
        return res.status(400).json({ error: "Debe ingresar la contraseña actual para cambiarla" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
      }
      const hash = await getPasswordHash(req.user.id);
      if (!hash) {
        return res.status(500).json({ error: "Error al verificar la contraseña" });
      }
      const valid = await bcrypt.compare(currentPassword, hash);
      if (!valid) {
        return res.status(401).json({ error: "Contraseña actual incorrecta" });
      }
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(newPassword, salt);
    }

    const user = await updateUser(req.user.id, updates);
    return res.json({ user });
  } catch (err) {
    console.error("Error actualizando perfil:", err);
    return res.status(500).json({ error: "Error al actualizar el perfil" });
  }
});

export default router;
