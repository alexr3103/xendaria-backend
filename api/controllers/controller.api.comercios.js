import * as comerciosService from "../../services/comercios.service.js";
import {
  enviarConfirmacionSolicitudComercio,
  enviarSolicitudComercioAdmin,
} from "../../services/email.service.js";
import * as recompensasService from "../../services/recompensas_comercio.service.js";
import { responderError } from "../../utils/errores.js";

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
    return responderError(res, error, "No se pudo registrar la solicitud");
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
    return responderError(res, error, "No se pudo actualizar la solicitud");
  }
}

export async function getConfiguracionRecompensaAdmin(req, res) {
  try {
    const configuracion =
      await recompensasService.getConfiguracionRecompensaAdmin(
        req.params.idPunto
      );

    return res.status(200).json({
      configurada: Boolean(configuracion),
      configuracion,
    });
  } catch (error) {
    console.error("[getConfiguracionRecompensaAdmin]", error);
    return responderError(res, error, "No se pudo obtener la recompensa");
  }
}

export async function guardarConfiguracionRecompensa(req, res) {
  try {
    const configuracion =
      await recompensasService.guardarConfiguracionRecompensa(
        req.params.idPunto,
        req.body
      );

    return res.status(200).json({
      message: "Recompensa guardada correctamente",
      configuracion,
    });
  } catch (error) {
    console.error("[guardarConfiguracionRecompensa]", error);
    return responderError(res, error, "No se pudo guardar la recompensa");
  }
}

export async function getEstadoRecompensaUsuario(req, res) {
  try {
    const recompensa = await recompensasService.getEstadoRecompensaUsuario(
      req.user.id,
      req.params.idPunto
    );

    if (!recompensa) {
      return res.status(404).json({
        message: "Este comercio no tiene una recompensa configurada",
      });
    }

    return res.status(200).json(recompensa);
  } catch (error) {
    console.error("[getEstadoRecompensaUsuario]", error);
    return responderError(res, error, "No se pudo consultar la recompensa");
  }
}

export async function getMisCanjesRecompensas(req, res) {
  try {
    const canjes = await recompensasService.getCanjesRecompensasUsuario(
      req.user.id
    );

    return res.status(200).json(canjes);
  } catch (error) {
    console.error("[getMisCanjesRecompensas]", error);
    return responderError(
      res,
      error,
      "No se pudieron obtener los beneficios canjeados"
    );
  }
}

export async function canjearRecompensa(req, res) {
  try {
    const recompensa = await recompensasService.canjearRecompensa(
      req.user.id,
      req.params.idPunto
    );

    return res.status(201).json({
      message: "Recompensa abierta correctamente",
      recompensa,
    });
  } catch (error) {
    console.error("[canjearRecompensa]", error);
    return responderError(res, error, "No se pudo abrir la recompensa");
  }
}
