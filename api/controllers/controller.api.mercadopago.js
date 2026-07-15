import * as mercadopagoService from "../../services/mercadopago.service.js";
import * as ordenService from "../../services/orden.service.js";

export async function recibirWebhook(req, res) {
  try {
    console.log("[MercadoPago webhook] query:", req.query);
    console.log("[MercadoPago webhook] body:", req.body);

    const idPago = req.query["data.id"] || req.body?.data?.id;

    if (!idPago) {
      return res.status(200).json({
        ok: true,
        message: "Webhook recibido sin id de pago",
      });
    }

    const pago = await mercadopagoService.obtenerPagoPorId(idPago);

    console.log("[MercadoPago webhook] pago consultado:", pago);

    const ordenActualizada = await ordenService.actualizarOrdenDesdePagoMercadoPago(pago);

    console.log("[MercadoPago webhook] orden actualizada:", ordenActualizada?._id || null);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[recibirWebhook]", error);
    return res.status(500).json({ message: "No se pudo procesar el webhook de Mercado Pago" });
  }
}