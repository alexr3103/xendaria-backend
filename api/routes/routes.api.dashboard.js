import { Router } from "express";
import * as controllers from "../controllers/controller.api.dashboard.js";
import { verifyToken, requireAdmin } from "../../middleware/auth.middleware.js";

const route = Router();

route.get("/dashboard", verifyToken, requireAdmin, controllers.getDashboardAdmin);

export default route;
