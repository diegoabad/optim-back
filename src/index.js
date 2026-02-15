import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { query } from "./db/pool.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import uploadsRoutes from "./routes/uploads.js";
import projectsRoutes from "./routes/projects.js";
import repuestosRoutes from "./routes/repuestos.js";
import calculationsRoutes from "./routes/calculations.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/repuestos", repuestosRoutes);
app.use("/api/calculations", calculationsRoutes);

// Health check (incluye verificación de conexión a PostgreSQL)
app.get("/api/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, message: "OPTIM API", db: "ok" });
  } catch (err) {
    console.error("Health check DB:", err);
    res.status(503).json({ ok: false, message: "OPTIM API", db: "error" });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(config.port, () => {
  console.log(`API escuchando en http://localhost:${config.port}`);
});
