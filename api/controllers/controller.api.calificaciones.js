import * as serviceCalificaciones from "../../services/calificaciones.service.js";
import { emitRankingUpdated } from "../../services/socket.service.js";

function responderError(res, error, fallback) {
  return res.status(error.status || 500).json({
    message: error.message || fallback,
    distanciaMetros: error.distanciaMetros,
  });
}

export async function guardarCalificacionPunto(req, res) {
  try {
    const resultado = await serviceCalificaciones.guardarCalificacion({
      idUsuario: req.user.id,
      idPunto: req.params.idPunto,
      estrellas: req.body.estrellas,
      ubicacionActual: req.body,
    });

    emitRankingUpdated({
      reason: "rating-updated",
      idUsuario: req.user.id,
      idPunto: req.params.idPunto,
    });

    return res.status(200).json({
      message: "Calificacion guardada correctamente",
      calificacion: resultado.calificacion,
      resumen: resultado.resumen,
    });
  } catch (error) {
    console.error("[guardarCalificacionPunto]", error);
    return responderError(res, error, "Error al guardar calificacion");
  }
}

export async function getResumenCalificacionesPunto(req, res) {
  try {
    const resumen = await serviceCalificaciones.getResumenCalificacionesPunto(
      req.params.idPunto
    );

    return res.status(200).json(resumen);
  } catch (error) {
    console.error("[getResumenCalificacionesPunto]", error);
    return responderError(res, error, "Error al obtener resumen de calificaciones");
  }
}

export async function getMiCalificacionPunto(req, res) {
  try {
    const calificacion = await serviceCalificaciones.getCalificacionUsuarioPunto(
      req.user.id,
      req.params.idPunto
    );

    return res.status(200).json({ calificacion });
  } catch (error) {
    console.error("[getMiCalificacionPunto]", error);
    return responderError(res, error, "Error al obtener tu calificacion");
  }
}

export async function getMisCalificaciones(req, res) {
  try {
    const calificaciones = await serviceCalificaciones.getCalificacionesUsuario(
      req.user.id
    );

    return res.status(200).json(calificaciones);
  } catch (error) {
    console.error("[getMisCalificaciones]", error);
    return responderError(res, error, "Error al obtener tus calificaciones");
  }
}
