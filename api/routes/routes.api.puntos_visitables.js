import { Router } from "express";
import * as controllers from "../controllers/controller.api.puntos_visitables.js";
import { validatePunto } from "../../middleware/puntos.validate.middleware.js";
import { verifyToken, requireAdmin, optionalAuth } from "../../middleware/auth.middleware.js";
import { validateObjectId } from "../../middleware/objectid.validate.middleware.js";


const route = Router();

route.get("/", optionalAuth, controllers.getPuntos)
route.get("/admin/duplicados", verifyToken, requireAdmin, controllers.listarDuplicados);
route.post("/admin/duplicados/fusionar", verifyToken, requireAdmin, controllers.fusionarDuplicado);
route.post("/admin/fusionar-duplicados", verifyToken, requireAdmin, controllers.fusionarDuplicados);
route.post("/:id/vista-360/consultar", validateObjectId("id"), controllers.consultarVista360);
route.get("/:id", optionalAuth, validateObjectId("id"), controllers.getPuntosById)
route.post("/", verifyToken, requireAdmin, validatePunto, controllers.nuevoPunto);
route.post("/:id/vista-360/verificar", verifyToken, requireAdmin, validateObjectId("id"), controllers.verificarVista360);
route.post("/:id/multimedia", verifyToken, requireAdmin, validateObjectId("id"), controllers.agregarMultimedia);
route.delete("/:id/multimedia/:multimediaId", verifyToken, requireAdmin, validateObjectId("id", "multimediaId"), controllers.eliminarMultimedia);
route.delete("/:id", verifyToken, requireAdmin, validateObjectId("id"), controllers.eliminarPunto)
route.patch("/:id", verifyToken, requireAdmin, validateObjectId("id"), controllers.editarPunto)
route.put("/:id", verifyToken, requireAdmin, validateObjectId("id"), validatePunto, controllers.reemplazarPunto);

export default route
