import express from "express";
import * as controllers from "../controllers/controller.api.notificaciones.js";
import { verifyToken } from "../../middleware/auth.middleware.js";
import { validateObjectId } from "../../middleware/objectid.validate.middleware.js";

const route = express.Router();

route.use(verifyToken);

route.get("/", controllers.listar);
route.patch("/leer-todas", controllers.marcarTodasLeidas);
route.delete("/leidas", controllers.eliminarLeidas);
route.get("/push/clave-publica", controllers.getClavePublicaPush);
route.post("/push/suscripcion", controllers.guardarSuscripcionPush);
route.delete("/push/suscripcion", controllers.eliminarSuscripcionPush);
route.patch("/:id/leida", validateObjectId("id"), controllers.marcarLeida);
route.delete("/:id", validateObjectId("id"), controllers.eliminar);

export default route;
