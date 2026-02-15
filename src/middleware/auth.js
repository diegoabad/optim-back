import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { findUserById } from "../db/database.js";

/**
 * Middleware que verifica el token JWT en Authorization: Bearer <token>
 * Añade req.user con los datos del usuario (sin password).
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }
    if (user.status !== "active") {
      return res.status(403).json({
        error: user.status === "pending"
          ? "Cuenta pendiente de aprobación por un administrador"
          : "Cuenta deshabilitada",
      });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

/** Requiere estar autenticado y ser admin (role admin, status active). */
export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Acceso solo para administradores" });
    }
    next();
  });
}

/**
 * Middleware opcional: si hay token válido, pone req.user; si no, sigue sin él.
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await findUserById(decoded.userId);
    if (user) req.user = user;
  } catch (_) {}
  next();
}
