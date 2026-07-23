import { Router } from "express";
import * as controllers from "../controllers/controller.api.mercadopago.js";

const route = Router();

route.get("/retorno/:tipo", controllers.redirigirRetornoPago);
route.post("/webhook", controllers.recibirWebhook);

export default route;
