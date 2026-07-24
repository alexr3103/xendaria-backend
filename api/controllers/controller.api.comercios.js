import * as comerciosService from "../../services/comercios.service.js";
import {
  enviarConfirmacionSolicitudComercio,
  enviarSolicitudComercioAdmin,
} from "../../services/email.service.js";

export async function crearSolicitudComercio(req, res) {
  try {
    const solicitud = await comerciosService.crearSolicitudComercio(req.body);

    const [emailAdmin, emailComercio] = await Promise.allSettled([
      enviarSolicitudComercioAdmin(solicitud),
      enviarConfirmacionSolicitudComercio(solicitud),
    ]);

    await comerciosService.actualizarEstadoEmails(solicitud._id, {
      emailAdminEnviado: emailAdmin.status === "fulfilled",
      emailComercioEnviado: emailComercio.status === "fulfilled",
    });

    if (emailAdmin.status === "rejected") {
      console.error("[crearSolicitudComercio - email admin]", emailAdmin.reason);
    }
    if (emailComercio.status === "rejected") {
      console.error(
        "[crearSolicitudComercio - email comercio]",
        emailComercio.reason
      );
    }

    return res.status(201).json({
      message:
        "Recibimos tu solicitud. Te vamos a contactar por email con los próximos pasos.",
      solicitudId: solicitud._id,
    });
  } catch (error) {
    console.error("[crearSolicitudComercio]", error);
    return res.status(error.status || 500).json({
      message: error.message || "No se pudo registrar la solicitud",
    });
  }
}

export async function getSolicitudesComercio(req, res) {
  try {
    const solicitudes = await comerciosService.getSolicitudesComercio({
      estado: req.query.estado,
    });
    return res.status(200).json(solicitudes);
  } catch (error) {
    console.error("[getSolicitudesComercio]", error);
    return res
      .status(500)
      .json({ message: "No se pudieron obtener las solicitudes" });
  }
}

export async function actualizarEstadoSolicitud(req, res) {
  try {
    const solicitud = await comerciosService.actualizarEstadoSolicitud(
      req.params.idSolicitud,
      req.body.estado
    );

    if (!solicitud) {
      return res.status(404).json({ message: "Solicitud no encontrada" });
    }

    return res.status(200).json({
      message: "Estado actualizado correctamente",
      solicitud,
    });
  } catch (error) {
    console.error("[actualizarEstadoSolicitud]", error);
    return res.status(error.status || 500).json({
      message: error.message || "No se pudo actualizar la solicitud",
    });
  }
}
