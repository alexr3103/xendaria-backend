import { Router } from "express";
import * as controllers from "../controllers/controller.api.envios.js";
import { verifyToken, requireAdmin } from "../../middleware/auth.middleware.js";

const route = Router();

route.get("/", controllers.getConfiguracionEnvio);
route.patch("/", verifyToken, requireAdmin, controllers.actualizarConfiguracionEnvio);

export default route;