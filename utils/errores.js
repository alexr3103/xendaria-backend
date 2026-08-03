const ESTADO_MINIMO = 400;
const ESTADO_MAXIMO = 599;

const PATRONES_TECNICOS = [
  /\b(?:failed to fetch|network ?error|fetch failed|socket hang up)\b/i,
  /\b(?:econnrefused|econnreset|etimedout|enotfound)\b/i,
  /\b(?:unauthorized|forbidden|internal server error|bad request|not found)\b/i,
  /\b(?:jwt malformed|invalid signature|token expired|cast to objectid|objectid)\b/i,
  /\b(?:validationerror|mongo(?:server)?error|bsonerror|multererror)\b/i,
  /\b(?:is a required field|must be|cannot be|invalid value|duplicate key)\b/i,
  /<\/?(?:html|body|head|pre)[^>]*>/i,
  /(?:^|\s)at\s+[\w.[\]/\\-]+\s*\(/,
];

function textoDesde(valor) {
  if (Array.isArray(valor)) {
    return valor
      .map((item) => textoDesde(item))
      .filter(Boolean)
      .join(" ");
  }

  if (typeof valor === "string") return valor.trim();
  if (valor?.message) return textoDesde(valor.message);
  return "";
}

export function getEstadoError(error, fallback = 500) {
  const estado = Number(error?.status || error?.statusCode);
  return Number.isInteger(estado) && estado >= ESTADO_MINIMO && estado <= ESTADO_MAXIMO
    ? estado
    : fallback;
}

export function esMensajeTecnico(mensaje) {
  const texto = textoDesde(mensaje);
  return !texto || PATRONES_TECNICOS.some((patron) => patron.test(texto));
}

export function getMensajePublico(error, fallback) {
  const estado = getEstadoError(error);
  const mensaje = textoDesde(error?.message || error);

  if (estado >= 500 || esMensajeTecnico(mensaje)) return fallback;
  return mensaje;
}

export function getMensajeValidacion(error) {
  const mensajes = Array.isArray(error?.errors)
    ? [...new Set(error.errors.map((item) => textoDesde(item)).filter(Boolean))]
    : [];

  const mensajesPublicos = mensajes.filter((mensaje) => !esMensajeTecnico(mensaje));
  return mensajesPublicos.length
    ? mensajesPublicos
        .map((mensaje) => (/[.!?]$/.test(mensaje) ? mensaje : `${mensaje}.`))
        .join(" ")
    : "Revisá los datos ingresados e intentá nuevamente.";
}

export function responderError(res, error, fallback, extras = {}) {
  const estado = getEstadoError(error);
  return res.status(estado).json({
    message: getMensajePublico(error, fallback),
    ...extras,
  });
}
