import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createProject } from "../db/database.js";

const router = Router();
const TYPES = ["pdp", "poisson", "cep"];

/**
 * POST /api/calculations
 * Guarda un cálculo completo: datos ingresados (inputs) + resultados.
 * Crea un proyecto con payload = { inputs, results }.
 *
 * Body (según tipo, alineado con el frontend):
 *
 * - type: "pdp" | "poisson" | "cep"
 * - name: string (opcional; si no se envía se genera uno por defecto)
 * - inputs: objeto con los datos del formulario
 * - results: objeto con el retorno de calculatePDP / calculatePoisson / calculateCEP
 *
 * PDP inputs: { monthlyDemand, deliveryTimesDays, orderQuantityPerOrder, consequence }
 * PDP results: { reorderPoint, serviceLevel, confidenceLevel, annualDemand, ... }
 *
 * Poisson inputs: { partsOperating, mttf, leadTimeDays, consequence }
 * Poisson results: { stockMin, stockMax, targetConfidence, actualConfidence, lambda, table, criticality }
 *
 * CEP inputs: { annualDemand, orderCost, holdingCostPerUnit }
 * CEP results: { eoq, ordersPerYear, daysBetweenOrders, totalOrderingCost, totalHoldingCost, totalCost }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { type, name, inputs, results } = req.body;

    if (!type || !TYPES.includes(type)) {
      return res.status(400).json({
        error: "Tipo inválido",
        allowed: TYPES,
      });
    }

    const payloadInputs = inputs != null && typeof inputs === "object" ? inputs : {};
    const payloadResults = results != null && typeof results === "object" ? results : {};
    const payload = { inputs: payloadInputs, results: payloadResults };

    const projectName =
      name && typeof name === "string" && name.trim()
        ? name.trim()
        : defaultCalculationName(type);

    const project = await createProject(req.user.id, {
      name: projectName,
      type,
      payload,
    });

    return res.status(201).json(project);
  } catch (err) {
    console.error("Error guardando cálculo:", err);
    return res.status(500).json({ error: "Error al guardar el cálculo" });
  }
});

function defaultCalculationName(type) {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10);
  const labels = { pdp: "PDP", poisson: "Poisson", cep: "CEP" };
  return `${labels[type] || type} ${dateStr}`;
}

export default router;
