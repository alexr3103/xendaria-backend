import { ObjectId } from "mongodb";
import webpush from "web-push";
import { getDB } from "./db.js";
import { getRankingUsuarios } from "./ranking.service.js";

const LIMITE_NOTIFICACIONES = 50;
let webPushConfigurado = false;

function notificacionesCollection() {
  return getDB().collection("notificaciones");
}

function suscripcionesCollection() {
  return getDB().collection("push_suscripciones");
}

function eventosPushCollection() {
  return getDB().collection("eventos_push");
}

function posicionesRankingCollection() {
  return getDB().collection("ranking_notificaciones_estado");
}

function usuariosCollection() {
  return getDB().collection("usuarios");
}

function configurarWebPush() {
  if (webPushConfigurado) return true;

  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = String(
    process.env.VAPID_SUBJECT || "mailto:xendariaoficial@gmail.com"
  ).trim();

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  webPushConfigurado = true;
  return true;
}

function serializarNotificacion(notificacion) {
  return {
    ...notificacion,
    _id: notificacion._id.toString(),
    idUsuario: notificacion.idUsuario.toString(),
  };
}

function normalizarLimite(value) {
  return Math.min(
    Math.max(Number.parseInt(value, 10) || 30, 1),
    LIMITE_NOTIFICACIONES
  );
}

async function enviarPushASuscripcion(suscripcion, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: suscripcion.endpoint,
        keys: suscripcion.keys,
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await suscripcionesCollection().deleteOne({ _id: suscripcion._id });
      return false;
    }

    console.error("[enviarPushASuscripcion]", error.message || error);
    return false;
  }
}

export async function asegurarIndicesNotificaciones() {
  await notificacionesCollection().createIndex(
    { idUsuario: 1, createdAt: -1 },
    { name: "notificaciones_usuario_fecha" }
  );
  await notificacionesCollection().createIndex(
    { idUsuario: 1, leida: 1 },
    { name: "notificaciones_usuario_leida" }
  );
  await notificacionesCollection().createIndex(
    { claveEvento: 1 },
    {
      unique: true,
      sparse: true,
      name: "notificaciones_evento_unico",
    }
  );
  await suscripcionesCollection().createIndex(
    { endpoint: 1 },
    { unique: true, name: "push_endpoint_unico" }
  );
  await suscripcionesCollection().createIndex(
    { idUsuario: 1 },
    { name: "push_usuario" }
  );
  await eventosPushCollection().createIndex(
    { claveEvento: 1 },
    { unique: true, name: "push_evento_unico" }
  );
  await posicionesRankingCollection().createIndex(
    { idUsuario: 1 },
    { unique: true, name: "ranking_notificacion_usuario" }
  );
}

export function getEstadoWebPush() {
  return {
    disponible: configurarWebPush(),
    clavePublica: String(process.env.VAPID_PUBLIC_KEY || "").trim(),
  };
}

export async function guardarSuscripcionPush(idUsuario, suscripcion = {}) {
  if (
    !suscripcion.endpoint ||
    !suscripcion.keys?.p256dh ||
    !suscripcion.keys?.auth
  ) {
    const error = new Error("La suscripcion push no es valida");
    error.status = 400;
    throw error;
  }

  const ahora = new Date();
  await suscripcionesCollection().updateOne(
    { endpoint: suscripcion.endpoint },
    {
      $set: {
        idUsuario: new ObjectId(idUsuario),
        keys: {
          p256dh: suscripcion.keys.p256dh,
          auth: suscripcion.keys.auth,
        },
        updatedAt: ahora,
      },
      $setOnInsert: {
        endpoint: suscripcion.endpoint,
        createdAt: ahora,
      },
    },
    { upsert: true }
  );

  return { guardada: true };
}

export async function eliminarSuscripcionPush(idUsuario, endpoint) {
  if (!endpoint) return { eliminada: false };

  const resultado = await suscripcionesCollection().deleteOne({
    idUsuario: new ObjectId(idUsuario),
    endpoint,
  });

  return { eliminada: resultado.deletedCount > 0 };
}

export async function enviarPushUsuario(
  idUsuario,
  preferencia,
  payload
) {
  if (!configurarWebPush()) return { enviados: 0, disponible: false };

  const usuarioId = new ObjectId(idUsuario);
  const usuario = await usuariosCollection().findOne(
    {
      _id: usuarioId,
      activo: { $ne: false },
      role: { $not: /^admin$/i },
    },
    { projection: { configuracion: 1 } }
  );

  if (
    !usuario ||
    usuario.configuracion?.notificaciones?.[preferencia] !== true
  ) {
    return { enviados: 0, disponible: true };
  }

  const suscripciones = await suscripcionesCollection()
    .find({ idUsuario: usuarioId })
    .toArray();
  const resultados = await Promise.all(
    suscripciones.map((suscripcion) =>
      enviarPushASuscripcion(suscripcion, payload)
    )
  );

  return {
    enviados: resultados.filter(Boolean).length,
    disponible: true,
  };
}

export async function enviarPushMasivo({
  preferencia,
  claveEvento,
  titulo,
  mensaje,
  enlace = "/",
}) {
  if (!configurarWebPush()) return { enviados: 0, disponible: false };

  const evento = await eventosPushCollection().updateOne(
    { claveEvento },
    {
      $setOnInsert: {
        claveEvento,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  if (!evento.upsertedCount) {
    return { enviados: 0, duplicado: true, disponible: true };
  }

  const usuarios = await usuariosCollection()
    .find(
      {
        activo: { $ne: false },
        role: { $not: /^admin$/i },
        [`configuracion.notificaciones.${preferencia}`]: true,
      },
      { projection: { _id: 1 } }
    )
    .toArray();
  const suscripciones =
    usuarios.length > 0
      ? await suscripcionesCollection()
          .find({
            idUsuario: { $in: usuarios.map((usuario) => usuario._id) },
          })
          .toArray()
      : [];
  const resultados = await Promise.all(
    suscripciones.map((suscripcion) =>
      enviarPushASuscripcion(suscripcion, {
        titulo,
        mensaje,
        enlace,
      })
    )
  );

  return {
    enviados: resultados.filter(Boolean).length,
    disponible: true,
  };
}

export async function crearNotificacionUsuario({
  idUsuario,
  tipo,
  titulo,
  mensaje,
  enlace = "/",
  metadata = {},
  claveEvento,
  pushPreferencia,
}) {
  const usuarioId = new ObjectId(idUsuario);
  const ahora = new Date();
  const documento = {
    idUsuario: usuarioId,
    tipo,
    titulo,
    mensaje,
    enlace,
    metadata,
    leida: false,
    createdAt: ahora,
  };

  let creada = true;

  if (claveEvento) {
    documento.claveEvento = claveEvento;
    const resultado = await notificacionesCollection().updateOne(
      { claveEvento },
      { $setOnInsert: documento },
      { upsert: true }
    );
    creada = resultado.upsertedCount > 0;
  } else {
    await notificacionesCollection().insertOne(documento);
  }

  if (creada && pushPreferencia) {
    await enviarPushUsuario(usuarioId, pushPreferencia, {
      titulo,
      mensaje,
      enlace,
    });
  }

  return { creada };
}

export async function listarNotificaciones(idUsuario, limite) {
  const usuarioId = new ObjectId(idUsuario);
  const [notificaciones, noLeidas] = await Promise.all([
    notificacionesCollection()
      .find({ idUsuario: usuarioId })
      .sort({ createdAt: -1 })
      .limit(normalizarLimite(limite))
      .toArray(),
    notificacionesCollection().countDocuments({
      idUsuario: usuarioId,
      leida: false,
    }),
  ]);

  return {
    notificaciones: notificaciones.map(serializarNotificacion),
    noLeidas,
  };
}

export async function marcarNotificacionLeida(idUsuario, idNotificacion) {
  return notificacionesCollection().updateOne(
    {
      _id: new ObjectId(idNotificacion),
      idUsuario: new ObjectId(idUsuario),
    },
    { $set: { leida: true, leidaAt: new Date() } }
  );
}

export async function marcarTodasLeidas(idUsuario) {
  return notificacionesCollection().updateMany(
    {
      idUsuario: new ObjectId(idUsuario),
      leida: false,
    },
    { $set: { leida: true, leidaAt: new Date() } }
  );
}

export async function eliminarNotificacion(idUsuario, idNotificacion) {
  return notificacionesCollection().deleteOne({
    _id: new ObjectId(idNotificacion),
    idUsuario: new ObjectId(idUsuario),
  });
}

export async function eliminarNotificacionesLeidas(idUsuario) {
  return notificacionesCollection().deleteMany({
    idUsuario: new ObjectId(idUsuario),
    leida: true,
  });
}

export async function eliminarDatosNotificacionesUsuario(idUsuario) {
  const usuarioId = new ObjectId(idUsuario);

  await Promise.all([
    notificacionesCollection().deleteMany({
      $or: [
        { idUsuario: usuarioId },
        { "metadata.idSeguidor": usuarioId.toString() },
      ],
    }),
    suscripcionesCollection().deleteMany({ idUsuario: usuarioId }),
    posicionesRankingCollection().deleteMany({ idUsuario: usuarioId }),
  ]);
}

export async function sincronizarPosicionRanking(idUsuario) {
  const usuarioId = new ObjectId(idUsuario);
  const ranking = await getRankingUsuarios({ limit: 20 });
  const idsRanking = ranking.map((item) => new ObjectId(item.usuarioId));
  const posicionActual = ranking.find(
    (item) => item.usuarioId === idUsuario.toString()
  );
  const estadoAnterior = await posicionesRankingCollection().findOne({
    idUsuario: usuarioId,
  });
  const ahora = new Date();

  if (ranking.length > 0) {
    await posicionesRankingCollection().bulkWrite(
      ranking.map((item) => ({
        updateOne: {
          filter: { idUsuario: new ObjectId(item.usuarioId) },
          update: {
            $set: {
              posicion: item.posicion,
              updatedAt: ahora,
            },
          },
          upsert: true,
        },
      }))
    );
  }

  await posicionesRankingCollection().updateMany(
    idsRanking.length > 0
      ? { idUsuario: { $nin: idsRanking } }
      : {},
    { $set: { posicion: null, updatedAt: ahora } }
  );

  if (!posicionActual) return null;

  if (!estadoAnterior || estadoAnterior.posicion === null) {
    await crearNotificacionUsuario({
      idUsuario: usuarioId,
      tipo: "ranking",
      titulo: "Entraste al ranking",
      mensaje: `Ahora estás en el puesto ${posicionActual.posicion}.`,
      enlace: "/ranking",
      claveEvento: `ranking:${idUsuario}:entrada:${ahora.toISOString()}`,
    });
    return posicionActual;
  }

  if (posicionActual.posicion < estadoAnterior.posicion) {
    await crearNotificacionUsuario({
      idUsuario: usuarioId,
      tipo: "ranking",
      titulo: "Subiste en el ranking",
      mensaje: `Avanzaste al puesto ${posicionActual.posicion}.`,
      enlace: "/ranking",
      claveEvento: `ranking:${idUsuario}:${estadoAnterior.posicion}:${posicionActual.posicion}:${ahora.toISOString()}`,
    });
  }

  return posicionActual;
}
