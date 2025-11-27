import { Router } from "express";
import * as controllers from "../controllers/controller.api.puntos_visitables.js";
import { validatePunto } from "../../middleware/puntos.validate.middleware.js";


const route = Router();

route.get("/", controllers.getPuntos)
route.get("/:id", controllers.getPuntosById)
route.post("/", validatePunto, controllers.nuevoPunto);
route.delete("/:id", controllers.eliminarPunto)
route.patch("/:id", controllers.editarPunto)
route.put("/:id", validatePunto, controllers.reemplazarPunto);

export default route