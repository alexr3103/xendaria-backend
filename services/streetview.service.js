const STREET_VIEW_METADATA_URL =
  "https://maps.googleapis.com/maps/api/streetview/metadata";

export async function consultarStreetViewMetadata({ lat, lon, radio = 50 }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    const error = new Error("GOOGLE_MAPS_API_KEY no configurado");
    error.code = "STREET_VIEW_NOT_CONFIGURED";
    throw error;
  }

  const url = new URL(STREET_VIEW_METADATA_URL);
  url.searchParams.set("location", `${lat},${lon}`);
  url.searchParams.set("radius", String(radio));
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Street View respondio ${response.status}`);
  }

  const data = await response.json();

  if (data.status === "OK") {
    return {
      disponible: true,
      estado: data.status,
      panoId: data.pano_id || null,
      fechaImagen: data.date || null,
      copyright: data.copyright || null,
      mensaje: "Vista 360 disponible",
    };
  }

  if (data.status === "ZERO_RESULTS" || data.status === "NOT_FOUND") {
    return {
      disponible: false,
      estado: data.status,
      panoId: null,
      fechaImagen: null,
      copyright: null,
      mensaje: "No hay vista 360 para este punto",
    };
  }

  const error = new Error(data.error_message || "No se pudo verificar Street View");
  error.code = "STREET_VIEW_PROVIDER_ERROR";
  error.providerStatus = data.status;
  throw error;
}
