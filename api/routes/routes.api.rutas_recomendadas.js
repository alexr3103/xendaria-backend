import { Router } from "express";
import * as controllers from "../controllers/controller.api.rutas_recomendadas.js";
import { verifyToken, requireAdmin } from "../../middleware/auth.middleware.js";
import { validateObjectId } from "../../middleware/objectid.validate.middleware.js";

const route = Router();

route.get("/categorias", controllers.getCategoriasRutas);
route.get("/mis-realizadas", verifyToken, controllers.getMisRutasRealizadas);
route.get("/con-estado", verifyToken, controllers.getRutasConEstadoUsuario);
route.get("/admin/todas", verifyToken, requireAdmin, controllers.getRutasAdmin);

route.get("/", controllers.getRutas);
route.post("/", verifyToken, requireAdmin, controllers.crearRuta);

route.get(
  "/:idRuta/estado",
  verifyToken,
  validateObjectId("idRuta"),
  controllers.getEstadoRutaUsuario
);
route.post(
  "/:idRuta/completar",
  verifyToken,
  validateObjectId("idRuta"),
  controllers.registrarRutaRealizada
);
route.get(
  "/:idRuta/progreso",
  verifyToken,
  validateObjectId("idRuta"),
  controllers.getProgresoRutaUsuario
);
route.patch(
  "/:idRuta/progreso",
  verifyToken,
  validateObjectId("idRuta"),
  controllers.guardarProgresoRuta
);
route.delete(
  "/:idRuta/progreso",
  verifyToken,
  validateObjectId("idRuta"),
  controllers.descartarProgresoRuta
);
route.get("/:idRuta", validateObjectId("idRuta"), controllers.getRutaById);
route.patch(
  "/:idRuta",
  verifyToken,
  requireAdmin,
  validateObjectId("idRuta"),
  controllers.editarRuta
);
route.delete(
  "/:idRuta",
  verifyToken,
  requireAdmin,
  validateObjectId("idRuta"),
  controllers.eliminarRuta
);

export default route;
