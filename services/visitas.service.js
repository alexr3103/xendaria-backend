import { ObjectId } from "mongodb";
import { getDB } from "./db.js";
import * as servicePuntos from "./puntos_visitables.service.js";

const RADIO_VISITA_DEFAULT_METROS = 100;
const RADIO_VISITA_ESPACIOS_VERDES_METROS = 200;
const RADIO_TIERRA_METROS = 6371000;
const CATEGORIAS_ESPACIOS_VERDES = new Set([
  "espacios_verdes_publicos",
  "espacios_verdes_privados",
]);

function crearErrorUbicacion(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getCategoriasPunto(punto = {}) {
  return [
    ...(Array.isArray(punto.categorias) ? punto.categorias : []),
    punto.categoria,
  ].filter(Boolean);
}

function getRadioVisitaMetros(punto = {}) {
  const esEspacioVerde = getCategoriasPunto(punto).some((categoria) =>
    CATEGORIAS_ESPACIOS_VERDES.has(categoria)
  );

  return esEspacioVerde
    ? RADIO_VISITA_ESPACIOS_VERDES_METROS
    : RADIO_VISITA_DEFAULT_METROS;
}

function normalizarCoordenadasActuales(ubicacionActual = {}) {
  const lat = Number(
    ubicacionActual.lat ??
      ubicacionActual.latitude ??
      ubicacionActual.coords?.lat ??
      ubicacionActual.coords?.latitude
  );
  const lng = Number(
    ubicacionActual.lng ??
      ubicacionActual.lon ??
      ubicacionActual.longitude ??
      ubicacionActual.coords?.lng ??
      ubicacionActual.coords?.lon ??
      ubicacionActual.coords?.longitude
  );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw crearErrorUbicacion(
      "Se requiere una ubicación actual válida para registrar la visita",
      400
    );
  }

  return { lat, lng };
}

function getCoordenadasPunto(punto = {}) {
  const lat = Number(punto.lat ?? punto.ubicacion?.coordinates?.[1]);
  const lng = Number(punto.lon ?? punto.ubicacion?.coordinates?.[0]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw crearErrorUbicacion(
      "El punto no tiene una ubicación válida",
      400
    );
  }

  return { lat, lng };
}

function calcularDistanciaMetros(origen, destino) {
  const lat1 = (origen.lat * Math.PI) / 180;
  const lat2 = (destino.lat * Math.PI) / 180;
  const diferenciaLat = ((destino.lat - origen.lat) * Math.PI) / 180;
  const diferenciaLng = ((destino.lng - origen.lng) * Math.PI) / 180;

  const a =
    Math.sin(diferenciaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(diferenciaLng / 2) ** 2;

  return (
    RADIO_TIERRA_METROS *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

function validarCercaniaPunto(punto, ubicacionActual) {
  const coordenadasUsuario = normalizarCoordenadasActuales(ubicacionActual);
  const coordenadasPunto = getCoordenadasPunto(punto);
  const distanciaMetros = calcularDistanciaMetros(
    coordenadasUsuario,
    coordenadasPunto
  );
  const radioPermitidoMetros = getRadioVisitaMetros(punto);

  if (distanciaMetros > radioPermitidoMetros) {
    throw crearErrorUbicacion(
      `Necesitás estar a menos de ${radioPermitidoMetros} metros del punto para registrar la visita`,
      403
    );
  }

  return {
    distanciaMetros: Math.round(distanciaMetros),
    radioPermitidoMetros,
  };
}

function collection() {
  return getDB().collection("visitas");
}

function usuariosCollection() {
  return getDB().collection("usuarios");
}

function normalizarId(valor) {
  if (!valor) return null;
  if (valor instanceof ObjectId) return valor.toString();
  if (typeof valor === "string") return valor;
  if (valor.$oid) return valor.$oid;
  if (valor._id) return normalizarId(valor._id);
  if (valor.idPunto) return normalizarId(valor.idPunto);
  if (valor.punto) return normalizarId(valor.punto);
  if (valor.puntoId) return normalizarId(valor.puntoId);
  return null;
}

function normalizarFecha(valor) {
  const fecha = valor?.fechaVisita || valor?.visitadoEn || valor?.fecha || valor;
  const fechaDate = fecha ? new Date(fecha) : new Date();
  return Number.isNaN(fechaDate.getTime()) ? new Date() : fechaDate;
}

function normalizarVisitasUsuario(lista = []) {
  const visitasPorPunto = new Map();

  lista.forEach((valor) => {
    const id = normalizarId(valor);
    if (!id || !ObjectId.isValid(id) || visitasPorPunto.has(id)) return;

    visitasPorPunto.set(id, {
      idPunto: new ObjectId(id),
      fechaVisita: normalizarFecha(valor),
    });
  });

  return [...visitasPorPunto.values()];
}

function usuarioParticipaEnRanking(usuario) {
  return usuario?.configuracion?.mostrarActividadRanking !== false;
}

export async function asegurarIndiceVisitas() {
  await collection().createIndex(
    { idUsuario: 1, idPunto: 1 },
    { unique: true, name: "usuario_punto_unico" }
  );

  await collection().createIndex(
    { idPunto: 1, fechaVisita: -1 },
    { name: "punto_fecha" }
  );
}

export async function sincronizarVisitasDesdeUsuarios() {
  const usuarios = await usuariosCollection()
    .find(
      { "puntos_visitados.0": { $exists: true } },
      { projection: { _id: 1, puntos_visitados: 1, insignias: 1 } }
    )
    .toArray();

  if (usuarios.length === 0) return { upserted: 0 };

  const operaciones = [];

  usuarios.forEach((usuario) => {
    const insignias = new Set(
      (usuario.insignias || [])
        .map((insignia) => normalizarId(insignia?.idPunto || insignia?.punto || insignia))
        .filter(Boolean)
    );

    normalizarVisitasUsuario(usuario.puntos_visitados).forEach((visita) => {
      operaciones.push({
        updateOne: {
          filter: {
            idUsuario: usuario._id,
            idPunto: visita.idPunto,
          },
          update: {
            $setOnInsert: {
              idUsuario: usuario._id,
              idPunto: visita.idPunto,
              fechaVisita: visita.fechaVisita,
              otorgoInsignia: insignias.has(visita.idPunto.toString()),
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    });
  });

  if (operaciones.length === 0) return { upserted: 0 };

  const resultado = await collection().bulkWrite(operaciones, { ordered: false });
  return { upserted: resultado.upsertedCount || 0 };
}

export async function registrarVisita(idUsuario, idPunto, ubicacionActual) {
  const punto = await servicePuntos.getPuntosById(idPunto);
  if (!punto) return { punto: null, nuevaVisita: false };

  const cercania = validarCercaniaPunto(punto, ubicacionActual);

  const ahora = new Date();
  const resultado = await collection().updateOne(
    {
      idUsuario: new ObjectId(idUsuario),
      idPunto: new ObjectId(idPunto),
    },
    {
      $setOnInsert: {
        idUsuario: new ObjectId(idUsuario),
        idPunto: new ObjectId(idPunto),
        fechaVisita: ahora,
        otorgoInsignia: Boolean(punto.insignia),
        createdAt: ahora,
      },
    },
    { upsert: true }
  );

  return {
    punto,
    nuevaVisita: Boolean(resultado.upsertedId),
    ...cercania,
  };
}

export async function getPuntosVisitadosPorUsuario(idUsuario) {
  const visitas = await collection()
    .find({ idUsuario: new ObjectId(idUsuario) })
    .sort({ fechaVisita: -1 })
    .toArray();

  if (visitas.length === 0) return [];

  const puntos = await servicePuntos.getPuntosByIds(
    visitas.map((visita) => visita.idPunto)
  );
  const puntosPorId = new Map(puntos.map((punto) => [punto._id.toString(), punto]));

  return visitas
    .map((visita) => {
      const punto = puntosPorId.get(visita.idPunto.toString());
      if (!punto) return null;

      return {
        ...punto,
        fechaVisita: visita.fechaVisita,
        visitadoEn: visita.fechaVisita,
      };
    })
    .filter(Boolean);
}

export async function borrarVisitasUsuario(idUsuario) {
  return collection().deleteMany({ idUsuario: new ObjectId(idUsuario) });
}

export function puedeAparecerEnRanking(usuario) {
  return usuarioParticipaEnRanking(usuario);
}
