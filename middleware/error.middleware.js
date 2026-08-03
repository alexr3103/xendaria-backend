import {
  getEstadoError,
  getMensajePublico,
  getMensajeValidacion,
} from "../utils/errores.js";

export function rutaNoEncontrada(req, res) {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({
      message: "No encontramos el recurso solicitado.",
    });
  }

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    return res.redirect(`${frontendUrl.replace(/\/$/, "")}/404`);
  }

  return res.status(404).json({
    message: "No encontramos la página solicitada.",
  });
}

export function manejarError(error, _req, res, _next) {
  console.error("[errorNoControlado]", error);

  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Los datos enviados no tienen un formato válido.",
    });
  }

  if (error?.name === "ValidationError") {
    return res.status(400).json({ message: getMensajeValidacion(error) });
  }

  if (error?.code === 11000) {
    return res.status(409).json({
      message: "Ya existe un registro con esos datos.",
    });
  }

  const estado = getEstadoError(error);
  return res.status(estado).json({
    message: getMensajePublico(
      error,
      "Ocurrió un inconveniente inesperado. Intentá nuevamente en unos minutos."
    ),
  });
}
