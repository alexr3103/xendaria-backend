import { Router } from "express";
import * as controllers from "../controllers/controller.api.carrito.js";
import { verifyToken } from "../../middleware/auth.middleware.js";
import {
  validateObjectId,
  validateBodyObjectId,
} from "../../middleware/objectid.validate.middleware.js";
import { validateCantidad } from "../../middleware/carrito.validate.middleware.js";

const route = Router();

route.get("/", verifyToken, controllers.getCarrito);
route.post("/items", verifyToken, validateBodyObjectId("idProducto"), validateCantidad, controllers.agregarProducto);
route.patch("/items/:idProducto", verifyToken, validateObjectId("idProducto"), validateCantidad, controllers.actualizarCantidadProducto);
route.delete("/items/:idProducto", verifyToken, validateObjectId("idProducto"), controllers.eliminarProducto);

export default route;