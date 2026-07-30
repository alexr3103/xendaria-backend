import * as service from "../../services/notificaciones.service.js";

export async function listar(req, res) {
  try {
    const resultado = await service.listarNotificaciones(
      req.user.id,
      req.query.limit
    );
    return res.status(200).json(resultado);
  } catch (error) {
    console.error("[listarNotificaciones]", error);
    return res.status(500).json({
      message: "No se pudieron cargar las notificaciones",
    });
  }
}

export async function marcarLeida(req, res) {
  try {
    const resultado = await service.marcarNotificacionLeida(
      req.user.id,
      req.params.id
    );

    if (!resultado.matchedCount) {
      return res.status(404).json({ message: "Notificacion no encontrada" });
    }

    return res.status(200).json({ message: "Notificacion leida" });
  } catch (error) {
    console.error("[marcarNotificacionLeida]", error);
    return res.status(500).json({ message: "No se pudo actualizar la notificacion" });
  }
}

export async function marcarTodasLeidas(req, res) {
  try {
    const resultado = await service.marcarTodasLeidas(req.user.id);
    return res.status(200).json({
      message: "Notificaciones marcadas como leidas",
      actualizadas: resultado.modifiedCount,
    });
  } catch (error) {
    console.error("[marcarTodasLeidas]", error);
    return res.status(500).json({ message: "No se pudieron actualizar las notificaciones" });
  }
}

export async function eliminar(req, res) {
  try {
    const resultado = await service.eliminarNotificacion(
      req.user.id,
      req.params.id
    );

    if (!resultado.deletedCount) {
      return res.status(404).json({ message: "Notificacion no encontrada" });
    }

    return res.status(200).json({ message: "Notificacion eliminada" });
  } catch (error) {
    console.error("[eliminarNotificacion]", error);
    return res.status(500).json({ message: "No se pudo eliminar la notificacion" });
  }
}

export async function eliminarLeidas(req, res) {
  try {
    const resultado = await service.eliminarNotificacionesLeidas(req.user.id);
    return res.status(200).json({
      message: "Notificaciones leidas eliminadas",
      eliminadas: resultado.deletedCount,
    });
  } catch (error) {
    console.error("[eliminarNotificacionesLeidas]", error);
    return res.status(500).json({ message: "No se pudieron eliminar las notificaciones" });
  }
}

export function getClavePublicaPush(_req, res) {
  const estado = service.getEstadoWebPush();
  return res.status(estado.disponible ? 200 : 503).json(estado);
}

export async function guardarSuscripcionPush(req, res) {
  try {
    const resultado = await service.guardarSuscripcionPush(
      req.user.id,
      req.body
    );
    return res.status(201).json(resultado);
  } catch (error) {
    console.error("[guardarSuscripcionPush]", error);
    return res.status(error.status || 500).json({
      message: error.message || "No se pudo guardar la suscripcion push",
    });
  }
}

export async function eliminarSuscripcionPush(req, res) {
  try {
    const resultado = await service.eliminarSuscripcionPush(
      req.user.id,
      req.body?.endpoint
    );
    return res.status(200).json(resultado);
  } catch (error) {
    console.error("[eliminarSuscripcionPush]", error);
    return res.status(500).json({
      message: "No se pudo eliminar la suscripcion push",
    });
  }
}
