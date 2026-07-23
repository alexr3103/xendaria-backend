import { Router } from "express";
import * as controllers from "../controllers/controller.api.titulos.js";
import { verifyToken, requireAdmin } from "../../middleware/auth.middleware.js";
import { validateObjectId } from "../../middleware/objectid.validate.middleware.js";

const route = Router();

route.get("/", verifyToken, controllers.getTitulos);
route.get("/mios", verifyToken, controllers.getMisTitulos);
route.get(
  "/usuario/:idUsuario",
  verifyToken,
  validateObjectId("idUsuario"),
  controllers.getTitulosUsuario
);
route.post("/", verifyToken, requireAdmin, controllers.crearTitulo);
route.patch(
  "/:idTitulo",
  verifyToken,
  requireAdmin,
  validateObjectId("idTitulo"),
  controllers.editarTitulo
);
route.delete(
  "/:idTitulo",
  verifyToken,
  requireAdmin,
  validateObjectId("idTitulo"),
  controllers.eliminarTitulo
);

export default route;
