import * as serviceDashboard from "../../services/dashboard.service.js";

export async function getDashboardAdmin(_req, res) {
  try {
    const dashboard = await serviceDashboard.getDashboardAdmin();
    return res.status(200).json(dashboard);
  } catch (error) {
    console.error("[getDashboardAdmin]", error);
    return res.status(500).json({ message: "Error al obtener dashboard admin" });
  }
}
