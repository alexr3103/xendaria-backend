import { Router } from "express";
import * as controllers from "../controllers/controller.api.puntos_visitables.js";
import { validatePunto } from "../../middleware/puntos.validate.middleware.js";
import { verifyToken, requireAdmin } from "../../middleware/auth.middleware.js";
import { validateObjectId } from "../../middleware/objectid.validate.middleware.js";


const route = Router();

route.use(verifyToken);

route.get("/", controllers.getPuntos)
route.get("/admin/duplicados", requireAdmin, controllers.listarDuplicados);
route.post("/admin/duplicados/fusionar", requireAdmin, controllers.fusionarDuplicado);
route.post("/admin/fusionar-duplicados", requireAdmin, controllers.fusionarDuplicados);
route.post("/:id/vista-360/consultar", validateObjectId("id"), controllers.consultarVista360);
route.get("/:id", validateObjectId("id"), controllers.getPuntosById)
route.post("/", requireAdmin, validatePunto, controllers.nuevoPunto);
route.post("/:id/vista-360/verificar", requireAdmin, validateObjectId("id"), controllers.verificarVista360);
route.post("/:id/multimedia", requireAdmin, validateObjectId("id"), controllers.agregarMultimedia);
route.delete("/:id/multimedia/:multimediaId", requireAdmin, validateObjectId("id", "multimediaId"), controllers.eliminarMultimedia);
route.delete("/:id", requireAdmin, validateObjectId("id"), controllers.eliminarPunto)
route.patch("/:id", requireAdmin, validateObjectId("id"), controllers.editarPunto)
route.put("/:id", requireAdmin, validateObjectId("id"), validatePunto, controllers.reemplazarPunto);

export default route
