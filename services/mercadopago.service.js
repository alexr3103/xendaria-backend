import dotenv from "dotenv";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

dotenv.config();

function getMercadoPagoClient() {
  if (!process.env.MP_ACCESS_TOKEN) {
    throw new Error("MP_ACCESS_TOKEN no configurado");
  }

  return new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
  });
}

function normalizarUrl(url) {
  return (url || "").trim().replace(/\/$/, "");
}

function getFrontendUrl() {
  return normalizarUrl(process.env.FRONTEND_URL) || "http://localhost:5173";
}

function getBackUrls() {
  const frontendUrl = getFrontendUrl();

  return {
    success:
      normalizarUrl(process.env.MP_SUCCESS_URL) ||
      `${frontendUrl}/checkout/exito`,
    pending:
      normalizarUrl(process.env.MP_PENDING_URL) ||
      `${frontendUrl}/checkout/pendiente`,
    failure:
      normalizarUrl(process.env.MP_FAILURE_URL) ||
      `${frontendUrl}/checkout/error`,
  };
}

function puedeUsarAutoReturn(successUrl) {
  try {
    const url = new URL(successUrl);
    return url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function crearPreferenciaPago(orden) {
  const preference = new Preference(getMercadoPagoClient());
  const items = orden.items.map((item) => ({
    title: item.nombre,
    quantity: item.cantidad,
    unit_price: Number(item.precioUnitario),
    currency_id: "ARS",
  }));

  if (orden.costoEnvio > 0) {
    items.push({
      title: "Costo de envio",
      quantity: 1,
      unit_price: Number(orden.costoEnvio),
      currency_id: "ARS",
    });
  }

  const backendUrl = normalizarUrl(process.env.BACKEND_URL);
  const backUrls = getBackUrls();
  const body = {
    items,
    external_reference: orden.referencia || orden._id?.toString(),
    back_urls: backUrls,
  };

  if (orden.referencia) {
    body.metadata = {
      checkout_reference: orden.referencia,
      checkout: JSON.stringify(orden),
    };
  }

  if (puedeUsarAutoReturn(backUrls.success)) {
    body.auto_return = "approved";
  }

  if (backendUrl) {
    body.notification_url = `${backendUrl}/api/mercadopago/webhook`;
  }

  const respuesta = await preference.create({ body });

  return {
    id: respuesta.id,
    init_point: respuesta.init_point,
    sandbox_init_point: respuesta.sandbox_init_point,
  };
}

export async function obtenerPagoPorId(idPago) {
  const payment = new Payment(getMercadoPagoClient());
  const respuesta = await payment.get({ id: idPago });
  return respuesta;
}
