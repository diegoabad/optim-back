import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth } from "../middleware/auth.js";
import {
  ensureUserDir,
  listUserFiles,
  getFilePath,
  deleteUserFile,
  renameUserFile,
  isAllowedMime,
  getMaxSize,
} from "../lib/uploads.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.user) return cb(new Error("No autorizado"));
    const userDir = ensureUserDir(req.user.id);
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || path.extname(file.mimetype) || ".jpg";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: getMaxSize() },
  fileFilter: (req, file, cb) => {
    if (!isAllowedMime(file.mimetype)) {
      return cb(new Error("Tipo de archivo no permitido. Use JPEG, PNG, GIF o WebP."));
    }
    cb(null, true);
  },
});

/**
 * POST /api/uploads
 * Sube una imagen. Requiere Authorization: Bearer <token>.
 * FormData: field "image" (file).
 * Las imágenes se guardan en data/downloads/<userId>/
 */
router.post("/", requireAuth, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "La imagen no debe superar 2 MB" });
      }
      return res.status(400).json({ error: err.message || "Error al subir" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No se envió ningún archivo (campo 'image')" });
    }
    res.status(201).json({
      message: "Imagen guardada",
      filename: req.file.filename,
      path: `/api/uploads/${req.file.filename}`,
    });
  });
});

/**
 * GET /api/uploads
 * Lista los nombres de archivo del usuario. Requiere auth.
 */
router.get("/", requireAuth, (req, res) => {
  const files = listUserFiles(req.user.id);
  res.json({
    files: files.map((f) => ({
      filename: f,
      url: `/api/uploads/${f}`,
    })),
  });
});

/**
 * GET /api/uploads/:filename
 * Sirve una imagen del usuario. Requiere auth. Solo puede ver sus propias imágenes.
 */
router.get("/:filename", requireAuth, (req, res) => {
  const filePath = getFilePath(req.user.id, req.params.filename);
  if (!filePath) {
    return res.status(404).json({ error: "Imagen no encontrada" });
  }
  res.sendFile(filePath);
});

/**
 * PATCH /api/uploads/:filename
 * Renombra una imagen. Body: { filename: "nuevo-nombre.jpg" }
 */
router.patch("/:filename", requireAuth, (req, res) => {
  const newFilename = req.body?.filename;
  if (!newFilename || typeof newFilename !== "string" || !newFilename.trim()) {
    return res.status(400).json({ error: "Indique el nuevo nombre del archivo" });
  }
  const result = renameUserFile(req.user.id, req.params.filename, newFilename.trim());
  if (!result) {
    return res.status(404).json({ error: "No se pudo renombrar (archivo no encontrado o nombre ya existe)" });
  }
  return res.json({ filename: result, path: `/api/uploads/${result}` });
});

/**
 * DELETE /api/uploads/:filename
 * Elimina una imagen del usuario. Requiere auth.
 */
router.delete("/:filename", requireAuth, (req, res) => {
  const deleted = deleteUserFile(req.user.id, req.params.filename);
  if (!deleted) {
    return res.status(404).json({ error: "Imagen no encontrada" });
  }
  return res.status(204).send();
});

export default router;
