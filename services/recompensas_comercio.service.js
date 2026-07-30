import { ObjectId } from "mongodb";
import { getDB } from "./db.js";
import * as notificacionesService from "./notificaciones.service.js";

const CATEGORIA_COMERCIOS = "comercios";

function configuracionesCollection() {
  return getDB().collection("recompensas_comercio");
}

function canjesCollection() {
  return getDB().collection("canjes_recompensas_comercio");
}

function visitasCollection() {
  return getDB().collection("visitas");
}

function puntosCollection() {
  return getDB().collection("puntos_visitables");
}

function errorConEstado(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function categoriasPunto(punto = {}) {
  return [
    ...new Set(
      [
        ...(Array.isArray(punto.categorias) ? punto.categorias : []),
        punto.categoria,
      ]
        .map((categoria) => String(categoria || "").trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function normalizarTexto(value, campo, max) {
  const texto = String(value || "").trim();

  if (!texto) {
    throw errorConEstado(`El campo ${campo} es obligatorio`);
  }

  if (texto.length > max) {
    throw errorConEstado(
      `El campo ${campo} no puede superar los ${max} caracteres`
    );
  }

  return texto;
}

function normalizarVencimiento(value) {
  const texto = String(value || "").trim();
  if (!texto) {
    throw errorConEstado("La fecha de vencimiento es obligatoria");
  }

  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? new Date(`${texto}T23:59:59.999-03:00`)
    : new Date(texto);

  if (Number.isNaN(fecha.getTime())) {
    throw errorConEstado("La fecha de vencimiento no es válida");
  }

  return fecha;
}

function prepararConfiguracion(data = {}) {
  return {
    beneficio: normalizarTexto(data.beneficio, "beneficio", 180),
    codigo: normalizarTexto(data.codigo, "código", 60),
    venceEn: normalizarVencimiento(data.venceEn),
    activa: data.activa !== false,
  };
}

async function getPuntoComercio(idPunto) {
  const punto = await puntosCollection().findOne({
    _id: new ObjectId(idPunto),
    creadoPor: { $exists: false },
  });

  if (!punto) {
    throw errorConEstado("Punto no encontrado", 404);
  }

  if (!categoriasPunto(punto).includes(CATEGORIA_COMERCIOS)) {
    throw errorConEstado(
      "Las recompensas solo pueden configurarse en puntos de Comercios"
    );
  }

  return punto;
}

function estadoBase(configuracion, ahora = new Date()) {
  if (!configuracion.activa) return "inactiva";
  if (new Date(configuracion.venceEn) < ahora) return "vencida";
  return null;
}

function configuracionPublica(configuracion, estado, extra = {}) {
  return {
    configurada: true,
    beneficio: configuracion.beneficio,
    venceEn: configuracion.venceEn,
    estado,
    ...extra,
  };
}

export async function asegurarIndicesRecompensasComercio() {
  await configuracionesCollection().createIndex(
    { idPunto: 1 },
    { unique: true, name: "recompensa_punto_unico" }
  );
  await canjesCollection().createIndex(
    { idUsuario: 1, idPunto: 1 },
    { unique: true, name: "canje_usuario_punto_unico" }
  );
  await canjesCollection().createIndex(
    { idPunto: 1, canjeadaEn: -1 },
    { name: "canje_punto_fecha" }
  );
}

export async function guardarConfiguracionRecompensa(idPunto, data) {
  const punto = await getPuntoComercio(idPunto);
  const configuracionAnterior = await configuracionesCollection().findOne({
    idPunto: new ObjectId(idPunto),
  });
  const configuracion = prepararConfiguracion(data);
  const ahora = new Date();

  await configuracionesCollection().updateOne(
    { idPunto: new ObjectId(idPunto) },
    {
      $set: {
        ...configuracion,
        updatedAt: ahora,
      },
      $setOnInsert: {
        idPunto: new ObjectId(idPunto),
        createdAt: ahora,
      },
    },
    { upsert: true }
  );

  if (
    configuracion.activa &&
    (!configuracionAnterior || configuracionAnterior.activa === false)
  ) {
    try {
      await notificacionesService.enviarPushMasivo({
        preferencia: "recompensas",
        claveEvento: `recompensa-publicada:${idPunto}:${ahora.toISOString()}`,
        titulo: "Nueva recompensa disponible",
        mensaje: `${punto.nombre} sumó un beneficio para tu próxima visita.`,
        enlace: "/",
      });
    } catch (error) {
      console.error("[notificarRecompensaPublicada]", error);
    }
  }

  return getConfiguracionRecompensaAdmin(idPunto);
}

export async function eliminarConfiguracionRecompensa(idPunto) {
  return configuracionesCollection().deleteOne({
    idPunto: new ObjectId(idPunto),
  });
}

export async function getConfiguracionRecompensaAdmin(idPunto) {
  await getPuntoComercio(idPunto);
  const idPuntoObjectId = new ObjectId(idPunto);
  const configuracion = await configuracionesCollection().findOne({
    idPunto: idPuntoObjectId,
  });

  if (!configuracion) return null;

  const totalCanjes = await canjesCollection().countDocuments({
    idPunto: idPuntoObjectId,
  });

  return {
    ...configuracion,
    totalCanjes,
  };
}

export async function getEstadoRecompensaUsuario(idUsuario, idPunto) {
  const idPuntoObjectId = new ObjectId(idPunto);
  const idUsuarioObjectId = new ObjectId(idUsuario);
  const configuracion = await configuracionesCollection().findOne({
    idPunto: idPuntoObjectId,
  });

  if (!configuracion) return null;

  const punto = await puntosCollection().findOne({
    _id: idPuntoObjectId,
    activo: { $ne: false },
    creadoPor: { $exists: false },
  });

  if (!punto || !categoriasPunto(punto).includes(CATEGORIA_COMERCIOS)) {
    return configuracionPublica(configuracion, "inactiva");
  }

  const canje = await canjesCollection().findOne({
    idUsuario: idUsuarioObjectId,
    idPunto: idPuntoObjectId,
  });

  if (canje) {
    return configuracionPublica(configuracion, "canjeada", {
      canjeadaEn: canje.canjeadaEn,
    });
  }

  const estadoConfiguracion = estadoBase(configuracion);
  if (estadoConfiguracion) {
    return configuracionPublica(configuracion, estadoConfiguracion);
  }

  const visita = await visitasCollection().findOne({
    idUsuario: idUsuarioObjectId,
    idPunto: idPuntoObjectId,
  });

  return configuracionPublica(
    configuracion,
    visita ? "disponible" : "bloqueada"
  );
}

export async function getCanjesRecompensasUsuario(idUsuario) {
  const idUsuarioObjectId = new ObjectId(idUsuario);
  const canjes = await canjesCollection()
    .find({ idUsuario: idUsuarioObjectId })
    .sort({ canjeadaEn: -1 })
    .toArray();

  if (canjes.length === 0) return [];

  const idsPuntos = [
    ...new Set(canjes.map((canje) => canje.idPunto?.toString()).filter(Boolean)),
  ].map((id) => new ObjectId(id));
  const idsRecompensas = [
    ...new Set(
      canjes.map((canje) => canje.idRecompensa?.toString()).filter(Boolean)
    ),
  ].map((id) => new ObjectId(id));

  const [puntos, configuraciones] = await Promise.all([
    puntosCollection()
      .find({ _id: { $in: idsPuntos } })
      .project({ nombre: 1, direccion: 1 })
      .toArray(),
    configuracionesCollection()
      .find({ _id: { $in: idsRecompensas } })
      .project({ beneficio: 1, venceEn: 1 })
      .toArray(),
  ]);

  const puntosPorId = new Map(
    puntos.map((punto) => [punto._id.toString(), punto])
  );
  const configuracionesPorId = new Map(
    configuraciones.map((configuracion) => [
      configuracion._id.toString(),
      configuracion,
    ])
  );

  return canjes.map((canje) => {
    const punto = puntosPorId.get(canje.idPunto?.toString());
    const configuracion = configuracionesPorId.get(
      canje.idRecompensa?.toString()
    );

    return {
      _id: canje._id,
      idPunto: canje.idPunto,
      nombrePunto:
        canje.nombrePunto || punto?.nombre || "Comercio no disponible",
      direccion: canje.direccion || punto?.direccion || "",
      beneficio:
        canje.beneficio ||
        configuracion?.beneficio ||
        "Beneficio comercial canjeado",
      canjeadaEn: canje.canjeadaEn,
      venceEn: canje.venceEn || configuracion?.venceEn || null,
    };
  });
}

export async function canjearRecompensa(idUsuario, idPunto) {
  const idPuntoObjectId = new ObjectId(idPunto);
  const idUsuarioObjectId = new ObjectId(idUsuario);
  const punto = await getPuntoComercio(idPunto);

  if (punto.activo === false) {
    throw errorConEstado("Esta recompensa no está disponible", 409);
  }

  const configuracion = await configuracionesCollection().findOne({
    idPunto: idPuntoObjectId,
  });

  if (!configuracion || !configuracion.activa) {
    throw errorConEstado("Esta recompensa no está disponible", 404);
  }

  if (new Date(configuracion.venceEn) < new Date()) {
    throw errorConEstado("Esta recompensa está vencida", 410);
  }

  const visita = await visitasCollection().findOne({
    idUsuario: idUsuarioObjectId,
    idPunto: idPuntoObjectId,
  });

  if (!visita) {
    throw errorConEstado(
      "Tenés que visitar el comercio para desbloquear esta recompensa",
      403
    );
  }

  const ahora = new Date();

  try {
    await canjesCollection().insertOne({
      idUsuario: idUsuarioObjectId,
      idPunto: idPuntoObjectId,
      idRecompensa: configuracion._id,
      nombrePunto: punto.nombre || "",
      direccion: punto.direccion || "",
      beneficio: configuracion.beneficio,
      venceEn: configuracion.venceEn,
      canjeadaEn: ahora,
      createdAt: ahora,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw errorConEstado(
        "Esta recompensa ya fue abierta y no puede mostrarse nuevamente",
        409
      );
    }
    throw error;
  }

  return {
    beneficio: configuracion.beneficio,
    codigo: configuracion.codigo,
    canjeadaEn: ahora,
    venceEn: configuracion.venceEn,
  };
}
