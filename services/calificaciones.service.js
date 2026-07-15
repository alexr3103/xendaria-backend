import { ObjectId } from "mongodb";
import { getDB } from "./db.js";
import * as servicePuntos from "./puntos_visitables.service.js";

const RADIO_CALIFICACION_METROS = 100;

function collection() {
  return getDB().collection("calificaciones");
}

function visitasCollection() {
  return getDB().collection("visitas");
}

function validarEstrellas(estrellas) {
  const numero = Number(estrellas);

  if (!Number.isInteger(numero) || numero < 1 || numero > 5) {
    const error = new Error("La calificacion debe ser un numero entero entre 1 y 5");
    error.status = 400;
    throw error;
  }

  return numero;
}

function normalizarCoordenadasActuales(body = {}) {
  const lat = body.lat ?? body.latitude ?? body.coords?.lat ?? body.ubicacionActual?.lat;
  const lon =
    body.lon ??
    body.lng ??
    body.longitude ??
    body.coords?.lon ??
    body.coords?.lng ??
    body.ubicacionActual?.lon ??
    body.ubicacionActual?.lng;

  const latNumber = Number(lat);
  const lonNumber = Number(lon);

  if (!Number.isFinite(latNumber) || !Number.isFinite(lonNumber)) {
    const error = new Error("Se requiere la ubicacion actual para calificar");
    error.status = 400;
    throw error;
  }

  return { lat: latNumber, lon: lonNumber };
}

function getCoordenadasPunto(punto) {
  const lat = Number(punto.lat ?? punto.ubicacion?.coordinates?.[1]);
  const lon = Number(punto.lon ?? punto.ubicacion?.coordinates?.[0]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const error = new Error("El punto no tiene coordenadas validas");
    error.status = 400;
    throw error;
  }

  return { lat, lon };
}

function calcularDistanciaMetros(origen, destino) {
  const radioTierra = 6371000;
  const lat1 = origen.lat * (Math.PI / 180);
  const lat2 = destino.lat * (Math.PI / 180);
  const dLat = (destino.lat - origen.lat) * (Math.PI / 180);
  const dLon = (destino.lon - origen.lon) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return radioTierra * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function asegurarIndiceCalificaciones() {
  await collection().createIndex(
    { idUsuario: 1, idPunto: 1 },
    { unique: true, name: "usuario_punto_calificacion_unica" }
  );

  await collection().createIndex(
    { idPunto: 1, estrellas: -1 },
    { name: "punto_estrellas" }
  );
}

export async function guardarCalificacion({
  idUsuario,
  idPunto,
  estrellas,
  ubicacionActual,
}) {
  const estrellasNormalizadas = validarEstrellas(estrellas);
  const punto = await servicePuntos.getPuntosById(idPunto);

  if (!punto) {
    const error = new Error("Punto no encontrado");
    error.status = 404;
    throw error;
  }

  const idUsuarioObject = new ObjectId(idUsuario);
  const idPuntoObject = new ObjectId(idPunto);
  const visita = await visitasCollection().findOne({
    idUsuario: idUsuarioObject,
    idPunto: idPuntoObject,
  });

  if (!visita) {
    const error = new Error("Solo podes calificar puntos que ya visitaste");
    error.status = 403;
    throw error;
  }

  const coordsUsuario = normalizarCoordenadasActuales(ubicacionActual);
  const coordsPunto = getCoordenadasPunto(punto);
  const distanciaMetros = calcularDistanciaMetros(coordsUsuario, coordsPunto);

  if (distanciaMetros > RADIO_CALIFICACION_METROS) {
    const error = new Error("Tenes que estar en el punto para calificarlo");
    error.status = 403;
    error.distanciaMetros = Math.round(distanciaMetros);
    throw error;
  }

  const ahora = new Date();
  const resultado = await collection().findOneAndUpdate(
    {
      idUsuario: idUsuarioObject,
      idPunto: idPuntoObject,
    },
    {
      $set: {
        estrellas: estrellasNormalizadas,
        updatedAt: ahora,
      },
      $setOnInsert: {
        idUsuario: idUsuarioObject,
        idPunto: idPuntoObject,
        fechaCalificacion: ahora,
        createdAt: ahora,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  return {
    calificacion: resultado,
    punto,
    resumen: await getResumenCalificacionesPunto(idPunto),
  };
}

export async function getResumenCalificacionesPunto(idPunto) {
  const resultados = await collection()
    .aggregate([
      { $match: { idPunto: new ObjectId(idPunto) } },
      {
        $group: {
          _id: "$idPunto",
          promedioEstrellas: { $avg: "$estrellas" },
          totalCalificaciones: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const resumen = resultados[0];

  return {
    idPunto,
    promedioEstrellas: resumen
      ? Number(resumen.promedioEstrellas.toFixed(1))
      : 0,
    totalCalificaciones: resumen?.totalCalificaciones || 0,
  };
}

export async function getCalificacionUsuarioPunto(idUsuario, idPunto) {
  return collection().findOne({
    idUsuario: new ObjectId(idUsuario),
    idPunto: new ObjectId(idPunto),
  });
}

export async function getCalificacionesUsuario(idUsuario) {
  const calificaciones = await collection()
    .find({ idUsuario: new ObjectId(idUsuario) })
    .sort({ updatedAt: -1 })
    .toArray();

  if (calificaciones.length === 0) return [];

  const puntos = await servicePuntos.getPuntosByIds(
    calificaciones.map((calificacion) => calificacion.idPunto)
  );
  const puntosPorId = new Map(puntos.map((punto) => [punto._id.toString(), punto]));

  return calificaciones
    .map((calificacion) => {
      const punto = puntosPorId.get(calificacion.idPunto.toString());
      if (!punto) return null;

      return {
        _id: calificacion._id,
        idPunto: calificacion.idPunto,
        estrellas: calificacion.estrellas,
        fechaCalificacion: calificacion.fechaCalificacion,
        updatedAt: calificacion.updatedAt,
        punto,
      };
    })
    .filter(Boolean);
}
