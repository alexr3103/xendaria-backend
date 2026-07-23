import * as mercadopagoService from "../../services/mercadopago.service.js";
import * as ordenService from "../../services/orden.service.js";

export async function recibirWebhook(req, res) {
  try {
    const idPago = req.query["data.id"] || req.body?.data?.id;

    if (!idPago) {
      return res.status(200).json({
        ok: true,
        message: "Webhook recibido sin id de pago",
      });
    }

    const pago = await mercadopagoService.obtenerPagoPorId(idPago);

    const ordenActualizada = await ordenService.actualizarOrdenDesdePagoMercadoPago(pago);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[recibirWebhook]", error);
    return res.status(500).json({ message: "No se pudo procesar el webhook de Mercado Pago" });
  }
}

export function redirigirRetornoPago(req, res) {
  try {
    const urlRetorno = mercadopagoService.construirUrlRetornoFrontend(
      req.params.tipo,
      req.query
    );

    return res.redirect(303, urlRetorno);
  } catch (error) {
    console.error("[redirigirRetornoPago]", error);
    return res.redirect(
      303,
      mercadopagoService.construirUrlRetornoFrontend("error")
    );
  }
}
