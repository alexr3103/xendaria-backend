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
  const limpia = (url || "").trim().replace(/\/$/, "");
  if (!limpia) return "";
  if (/^https?:\/\//i.test(limpia)) return limpia;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?/i.test(limpia)) {
    return `http://${limpia}`;
  }
  return `https://${limpia}`;
}

function getFrontendUrl() {
  return normalizarUrl(process.env.FRONTEND_URL) || "http://localhost:5173";
}

function getBackendUrl() {
  return normalizarUrl(process.env.BACKEND_URL);
}

function esUrlPublica(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      !["localhost", "127.0.0.1"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function getUrlRetornoConfigurada(nombreEnv, fallbackUrl, usarRetornoBackend) {
  if (usarRetornoBackend) return fallbackUrl;

  const configurada = normalizarUrl(process.env[nombreEnv]);
  if (!configurada) return fallbackUrl;

  return configurada;
}

function getBackUrls() {
  const frontendUrl = getFrontendUrl();
  const backendUrl = getBackendUrl();
  const usarRetornoBackend = esUrlPublica(backendUrl);
  const baseRetorno = usarRetornoBackend
    ? `${backendUrl}/api/mercadopago/retorno`
    : frontendUrl;

  return {
    success: getUrlRetornoConfigurada(
      "MP_SUCCESS_URL",
      `${baseRetorno}${usarRetornoBackend ? "/exito" : "/checkout/exito"}`,
      usarRetornoBackend
    ),
    pending: getUrlRetornoConfigurada(
      "MP_PENDING_URL",
      `${baseRetorno}${usarRetornoBackend ? "/pendiente" : "/checkout/pendiente"}`,
      usarRetornoBackend
    ),
    failure: getUrlRetornoConfigurada(
      "MP_FAILURE_URL",
      `${baseRetorno}${usarRetornoBackend ? "/error" : "/checkout/error"}`,
      usarRetornoBackend
    ),
  };
}

function puedeUsarAutoReturn(successUrl) {
  return esUrlPublica(successUrl);
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

  if (esUrlPublica(backendUrl)) {
    body.notification_url = `${backendUrl}/api/mercadopago/webhook`;
  }

  const respuesta = await preference.create({ body });

  return {
    id: respuesta.id,
    init_point: respuesta.init_point,
    sandbox_init_point: respuesta.sandbox_init_point,
  };
}

export function construirUrlRetornoFrontend(tipo, query = {}) {
  const rutas = {
    exito: "/checkout/exito",
    success: "/checkout/exito",
    aprobado: "/checkout/exito",
    pendiente: "/checkout/pendiente",
    pending: "/checkout/pendiente",
    error: "/checkout/error",
    fallo: "/checkout/error",
    fallido: "/checkout/error",
    failure: "/checkout/error",
  };
  const url = new URL(`${getFrontendUrl()}${rutas[tipo] || rutas.error}`);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null) {
          url.searchParams.append(key, String(item));
        }
      });
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export async function obtenerPagoPorId(idPago) {
  const payment = new Payment(getMercadoPagoClient());
  const respuesta = await payment.get({ id: idPago });
  return respuesta;
}
