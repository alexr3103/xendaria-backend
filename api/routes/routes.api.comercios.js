import { Router } from "express";
import * as controllers from "../controllers/controller.api.comercios.js";
import { requireAdmin, verifyToken } from "../../middleware/auth.middleware.js";
import { validateObjectId } from "../../middleware/objectid.validate.middleware.js";

const route = Router();

route.post("/solicitudes", controllers.crearSolicitudComercio);
route.get(
  "/solicitudes",
  verifyToken,
  requireAdmin,
  controllers.getSolicitudesComercio
);
route.patch(
  "/solicitudes/:idSolicitud/estado",
  verifyToken,
  requireAdmin,
  validateObjectId("idSolicitud"),
  controllers.actualizarEstadoSolicitud
);
route.get(
  "/recompensas/admin/puntos/:idPunto",
  verifyToken,
  requireAdmin,
  validateObjectId("idPunto"),
  controllers.getConfiguracionRecompensaAdmin
);
route.put(
  "/recompensas/admin/puntos/:idPunto",
  verifyToken,
  requireAdmin,
  validateObjectId("idPunto"),
  controllers.guardarConfiguracionRecompensa
);
route.get(
  "/recompensas/mis-canjes",
  verifyToken,
  controllers.getMisCanjesRecompensas
);
route.get(
  "/recompensas/puntos/:idPunto",
  verifyToken,
  validateObjectId("idPunto"),
  controllers.getEstadoRecompensaUsuario
);
route.post(
  "/recompensas/puntos/:idPunto/canjear",
  verifyToken,
  validateObjectId("idPunto"),
  controllers.canjearRecompensa
);

export default route;
