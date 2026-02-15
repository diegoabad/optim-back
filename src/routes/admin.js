import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { findAllUsers, updateUserStatus, deleteUser } from "../db/database.js";

const router = Router();

/**
 * GET /api/admin/users?status=pending|activos
 * pending = solo pendientes; activos = habilitados + deshabilitados. Solo admin.
 */
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const status = req.query.status === "activos" || req.query.status === "pending"
      ? req.query.status
      : null;
    const users = await findAllUsers(status);
    return res.json({ users });
  } catch (err) {
    console.error("Error listando usuarios:", err);
    return res.status(500).json({ error: "Error al listar usuarios" });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Body: { status: "active" | "disabled" }
 * Actualiza el status del usuario (aprobar o deshabilitar). Solo admin.
 */
router.patch("/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!status || !["active", "disabled"].includes(status)) {
      return res.status(400).json({ error: "status debe ser 'active' o 'disabled'" });
    }
    const user = await updateUserStatus(id, status);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    return res.json({ user });
  } catch (err) {
    console.error("Error actualizando usuario:", err);
    return res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Elimina un usuario. No se puede eliminar a uno mismo. Solo admin.
 */
router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.user.id === id) {
      return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
    }
    const deleted = await deleteUser(id);
    if (!deleted) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    return res.json({ deleted: true, id });
  } catch (err) {
    console.error("Error eliminando usuario:", err);
    return res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

export default router;
