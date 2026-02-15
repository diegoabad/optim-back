import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createRepuesto,
  findRepuestosByUserId,
  findRepuestoByIdAndUser,
  updateRepuesto,
  deleteRepuesto,
} from "../db/database.js";

const router = Router();
const TYPES = ["ar", "br"]; // ar = alta rotación (PDP), br = baja rotación (Poisson)

/**
 * POST /api/repuestos
 * Body: { type: "ar"|"br", code (obligatorio), name?, image?, payload? }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { type, code, name, image, payload } = req.body;
    if (!type || !TYPES.includes(type)) {
      return res.status(400).json({
        error: "Tipo inválido",
        allowed: TYPES,
      });
    }
    const codeStr = code != null ? String(code).trim() : "";
    if (!codeStr) {
      return res.status(400).json({ error: "El código es obligatorio" });
    }
    const repuesto = await createRepuesto(req.user.id, {
      type,
      code: codeStr,
      name: name != null ? String(name).trim() || null : null,
      image: image != null ? String(image).trim() || null : null,
      payload: payload || {},
    });
    return res.status(201).json(repuesto);
  } catch (err) {
    console.error("Error creando repuesto:", err);
    return res.status(500).json({ error: "Error al crear el repuesto" });
  }
});

/**
 * GET /api/repuestos?type=ar|br
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const type = req.query.type && TYPES.includes(req.query.type) ? req.query.type : null;
    const list = await findRepuestosByUserId(req.user.id, type);
    return res.json({ repuestos: list });
  } catch (err) {
    console.error("Error listando repuestos:", err);
    return res.status(500).json({ error: "Error al listar repuestos" });
  }
});

/**
 * GET /api/repuestos/:id
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const repuesto = await findRepuestoByIdAndUser(id, req.user.id);
    if (!repuesto) {
      return res.status(404).json({ error: "Repuesto no encontrado" });
    }
    return res.json(repuesto);
  } catch (err) {
    console.error("Error obteniendo repuesto:", err);
    return res.status(500).json({ error: "Error al obtener el repuesto" });
  }
});

/**
 * PATCH /api/repuestos/:id
 * Body: { code?, name?, image?, payload? }
 */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const { code, name, image, payload } = req.body;
    if (code !== undefined) {
      const codeStr = code != null ? String(code).trim() : "";
      if (!codeStr) {
        return res.status(400).json({ error: "El código es obligatorio" });
      }
    }
    const repuesto = await updateRepuesto(id, req.user.id, {
      ...(code !== undefined && { code: code != null ? String(code).trim() : null }),
      ...(name !== undefined && { name: typeof name === "string" ? name.trim() || null : null }),
      ...(image !== undefined && { image: image != null ? String(image).trim() || null : null }),
      ...(payload !== undefined && { payload }),
    });
    if (!repuesto) {
      return res.status(404).json({ error: "Repuesto no encontrado" });
    }
    return res.json(repuesto);
  } catch (err) {
    console.error("Error actualizando repuesto:", err);
    return res.status(500).json({ error: "Error al actualizar el repuesto" });
  }
});

/**
 * DELETE /api/repuestos/:id
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const deleted = await deleteRepuesto(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: "Repuesto no encontrado" });
    }
    return res.status(204).send();
  } catch (err) {
    console.error("Error eliminando repuesto:", err);
    return res.status(500).json({ error: "Error al eliminar el repuesto" });
  }
});

export default router;
