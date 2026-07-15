import { Router } from "express";
import * as controllers from "../controllers/controller.api.merch.js";
import { validateProductoMerch } from "../../middleware/merch.validate.middleware.js";
import { verifyToken, requireAdmin } from "../../middleware/auth.middleware.js";
import { validateObjectId } from "../../middleware/objectid.validate.middleware.js";

const route = Router();

route.get("/", controllers.getProductosMerch);
route.get("/:id", validateObjectId("id"), controllers.getProductoMerchById);
route.post("/", verifyToken, requireAdmin, validateProductoMerch, controllers.nuevoProductoMerch);
route.patch("/:id", verifyToken, requireAdmin, validateObjectId("id"), controllers.editarProductoMerch);
route.delete("/:id", verifyToken, requireAdmin, validateObjectId("id"), controllers.eliminarProductoMerch);

export default route;