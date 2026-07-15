import { Router } from "express";
import * as controllers from "../controllers/controller.api.calificaciones.js";
import { verifyToken } from "../../middleware/auth.middleware.js";
import { validateObjectId } from "../../middleware/objectid.validate.middleware.js";

const route = Router();

route.get("/mias", verifyToken, controllers.getMisCalificaciones);
route.get(
  "/puntos/:idPunto/resumen",
  validateObjectId("idPunto"),
  controllers.getResumenCalificacionesPunto
);
route.get(
  "/puntos/:idPunto/mia",
  verifyToken,
  validateObjectId("idPunto"),
  controllers.getMiCalificacionPunto
);
route.put(
  "/puntos/:idPunto",
  verifyToken,
  validateObjectId("idPunto"),
  controllers.guardarCalificacionPunto
);

export default route;
