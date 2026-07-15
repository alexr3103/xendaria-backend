import { Router } from "express";
import * as controllers from "../controllers/controller.api.orden.js";
import { verifyToken, requireAdmin } from "../../middleware/auth.middleware.js";
import { validateCrearCheckoutMercadoPago } from "../../middleware/orden.validate.middleware.js";
import { validateObjectId } from "../../middleware/objectid.validate.middleware.js";

const route = Router();

route.post(
  "/preferencia-mercadopago",
  verifyToken,
  validateCrearCheckoutMercadoPago,
  controllers.crearPreferenciaMercadoPagoDesdeCarrito
);
route.get("/mis-ordenes", verifyToken, controllers.getMisOrdenes);
route.get("/", verifyToken, requireAdmin, controllers.getOrdenes);
route.patch("/:id/estado", verifyToken, requireAdmin, validateObjectId("id"), controllers.actualizarEstadoOrden);

export default route;
