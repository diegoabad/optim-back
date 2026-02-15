import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Carpeta base donde se guardan las imágenes por usuario (en inglés: downloads) */
export const UPLOADS_BASE = path.join(__dirname, "../../data/downloads");

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export function ensureUserDir(userId) {
  const userDir = path.join(UPLOADS_BASE, String(userId));
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

export function getUserDir(userId) {
  return path.join(UPLOADS_BASE, String(userId));
}

export function listUserFiles(userId) {
  const userDir = getUserDir(userId);
  if (!fs.existsSync(userDir)) return [];
  return fs.readdirSync(userDir).filter((f) => {
    const p = path.join(userDir, f);
    return fs.statSync(p).isFile();
  });
}

export function getFilePath(userId, filename) {
  const userDir = path.resolve(getUserDir(userId));
  const base = path.basename(filename);
  if (!base || base.includes("..")) return null;
  const filePath = path.resolve(userDir, base);
  if (!filePath.startsWith(userDir)) return null;
  return fs.existsSync(filePath) ? filePath : null;
}

/**
 * Elimina un archivo del usuario si existe. Devuelve true si se borró, false si no existía o no es válido.
 */
export function deleteUserFile(userId, filename) {
  const filePath = getFilePath(userId, filename);
  if (!filePath) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Renombra un archivo del usuario. newFilename debe ser solo el nombre del archivo (sin path).
 * Conserva la extensión si no se indica. Devuelve el nuevo filename o null si falla.
 */
export function renameUserFile(userId, oldFilename, newFilename) {
  const filePath = getFilePath(userId, oldFilename);
  if (!filePath) return null;
  const base = path.basename(newFilename);
  if (!base || base.includes("..")) return null;
  const safeName = base.includes(".") ? base : base + path.extname(oldFilename);
  const userDir = getUserDir(userId);
  const newPath = path.resolve(userDir, safeName);
  if (!newPath.startsWith(userDir)) return null;
  if (fs.existsSync(newPath) && newPath !== filePath) return null;
  try {
    fs.renameSync(filePath, newPath);
    return safeName;
  } catch {
    return null;
  }
}

export function isAllowedMime(mimetype) {
  return ALLOWED_MIMES.includes(mimetype);
}

export function getMaxSize() {
  return MAX_SIZE;
}
