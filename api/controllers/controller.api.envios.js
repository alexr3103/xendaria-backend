import * as service from "../../services/envios.service.js";

export async function getConfiguracionEnvio(req, res) {
  try {
    const config = await service.getConfiguracionEnvio();
    return res.status(200).json(config);
  } catch (error) {
    console.error("[getConfiguracionEnvio]", error);
    return res.status(500).json({ message: "No se pudo obtener la configuracion de envios" });
  }
}

export async function actualizarConfiguracionEnvio(req, res) {
  try {
    const data = req.body;
    const config = await service.actualizarConfiguracionEnvio(data);
    return res.status(200).json(config);
  } catch (error) {
    console.error("[actualizarConfiguracionEnvio]", error);
    return res.status(500).json({ message: "No se pudo actualizar la configuracion de envios" });
  }
}