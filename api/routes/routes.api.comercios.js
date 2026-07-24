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

export default route;
