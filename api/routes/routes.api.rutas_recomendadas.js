import { Router } from "express";
import * as controllers from "../controllers/controller.api.rutas_recomendadas.js";
import { verifyToken, requireAdmin } from "../../middleware/auth.middleware.js";
import { validateObjectId } from "../../middleware/objectid.validate.middleware.js";

const route = Router();

route.use(verifyToken);

route.get("/categorias", controllers.getCategoriasRutas);
route.get("/mis-realizadas", controllers.getMisRutasRealizadas);
route.get("/con-estado", controllers.getRutasConEstadoUsuario);
route.get("/admin/todas", requireAdmin, controllers.getRutasAdmin);

route.get("/", controllers.getRutas);
route.post("/", requireAdmin, controllers.crearRuta);

route.get(
  "/:idRuta/estado",
  validateObjectId("idRuta"),
  controllers.getEstadoRutaUsuario
);
route.post(
  "/:idRuta/completar",
  validateObjectId("idRuta"),
  controllers.registrarRutaRealizada
);
route.get(
  "/:idRuta/progreso",
  validateObjectId("idRuta"),
  controllers.getProgresoRutaUsuario
);
route.patch(
  "/:idRuta/progreso",
  validateObjectId("idRuta"),
  controllers.guardarProgresoRuta
);
route.delete(
  "/:idRuta/progreso",
  validateObjectId("idRuta"),
  controllers.descartarProgresoRuta
);
route.get("/:idRuta", validateObjectId("idRuta"), controllers.getRutaById);
route.patch(
  "/:idRuta",
  requireAdmin,
  validateObjectId("idRuta"),
  controllers.editarRuta
);
route.delete(
  "/:idRuta",
  requireAdmin,
  validateObjectId("idRuta"),
  controllers.eliminarRuta
);

export default route;
