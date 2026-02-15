import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createProject,
  findProjectsByUserId,
  findProjectByIdAndUser,
  updateProject,
  deleteProject,
} from "../db/database.js";

const router = Router();
const TYPES = ["pdp", "poisson", "cep"];

/**
 * POST /api/projects
 * Body: { name, type: "pdp"|"poisson"|"cep", payload: object }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, type, payload } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }
    if (!type || !TYPES.includes(type)) {
      return res.status(400).json({
        error: "Tipo inválido",
        allowed: TYPES,
      });
    }
    const project = await createProject(req.user.id, {
      name: name.trim(),
      type,
      payload: payload || {},
    });
    return res.status(201).json(project);
  } catch (err) {
    console.error("Error creando proyecto:", err);
    return res.status(500).json({ error: "Error al crear el proyecto" });
  }
});

/**
 * GET /api/projects?type=pdp|poisson|cep
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const type = req.query.type && TYPES.includes(req.query.type) ? req.query.type : null;
    const list = await findProjectsByUserId(req.user.id, type);
    return res.json({ projects: list });
  } catch (err) {
    console.error("Error listando proyectos:", err);
    return res.status(500).json({ error: "Error al listar proyectos" });
  }
});

/**
 * GET /api/projects/:id
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const project = await findProjectByIdAndUser(id, req.user.id);
    if (!project) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }
    return res.json(project);
  } catch (err) {
    console.error("Error obteniendo proyecto:", err);
    return res.status(500).json({ error: "Error al obtener el proyecto" });
  }
});

/**
 * PATCH /api/projects/:id
 * Body: { name?, payload? }
 */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const { name, payload } = req.body;
    const project = await updateProject(id, req.user.id, {
      ...(name !== undefined && { name: typeof name === "string" ? name.trim() : name }),
      ...(payload !== undefined && { payload }),
    });
    if (!project) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }
    return res.json(project);
  } catch (err) {
    console.error("Error actualizando proyecto:", err);
    return res.status(500).json({ error: "Error al actualizar el proyecto" });
  }
});

/**
 * DELETE /api/projects/:id
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const deleted = await deleteProject(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }
    return res.status(204).send();
  } catch (err) {
    console.error("Error eliminando proyecto:", err);
    return res.status(500).json({ error: "Error al eliminar el proyecto" });
  }
});

export default router;
