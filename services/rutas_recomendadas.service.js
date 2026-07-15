import { ObjectId } from "mongodb";
import { getDB } from "./db.js";
import * as servicePuntos from "./puntos_visitables.service.js";

export const CATEGORIAS_RUTAS = [
  "imperdibles",
  "historia_patrimonio",
  "arte_cultura",
  "curiosidades_leyendas",
  "verde_aire_libre",
  "sabores_comercios",
];

const MODOS_RUTA = new Set(["corta", "larga"]);

function collection() {
  return getDB().collection("rutas_recomendadas");
}

function realizadasCollection() {
  return getDB().collection("rutas_realizadas");
}

function progresosCollection() {
  return getDB().collection("rutas_progreso");
}

function crearError(message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function normalizarTexto(valor, { requerido = false, max = 200 } = {}) {
  const texto = String(valor || "").trim();

  if (requerido && !texto) {
    throw crearError("Campo requerido incompleto");
  }

  return texto.slice(0, max);
}

function toObjectId(valor, nombre = "id") {
  if (valor instanceof ObjectId) return valor;
  const id = typeof valor === "object" ? valor?.idPunto || valor?._id || valor?.id : valor;

  if (!id || !ObjectId.isValid(id)) {
    throw crearError(`${nombre} no es un ObjectId valido`);
  }

  return new ObjectId(id);
}

function normalizarPuntosIds(puntos) {
  if (!Array.isArray(puntos)) {
    throw crearError("La ruta necesita una lista de puntos");
  }

  const ids = puntos.map((punto) => toObjectId(punto, "idPunto"));
  const idsUnicos = new Map();

  ids.forEach((id) => {
    idsUnicos.set(id.toString(), id);
  });

  if (idsUnicos.size !== ids.length) {
    throw crearError("La ruta no puede tener puntos repetidos");
  }

  if (ids.length < 3) {
    throw crearError("Una ruta recomendada necesita minimo 3 puntos");
  }

  return ids;
}

function getPuntosHash(ids) {
  return ids
    .map((id) => id.toString())
    .sort()
    .join("|");
}

function validarCategoria(categoria) {
  const value = String(categoria || "").trim();

  if (!CATEGORIAS_RUTAS.includes(value)) {
    throw crearError("Categoria de ruta invalida");
  }

  return value;
}

async function validarPuntosExistentes(ids) {
  const puntos = await servicePuntos.getPuntosByIds(ids);
  const puntosPorId = new Map(puntos.map((punto) => [punto._id.toString(), punto]));
  const faltantes = ids
    .map((id) => id.toString())
    .filter((id) => !puntosPorId.has(id));

  if (faltantes.length > 0) {
    throw crearError("Todos los puntos de la ruta deben existir en el mapa", 400, {
      puntosFaltantes: faltantes,
    });
  }

  return ids.map((id) => puntosPorId.get(id.toString()));
}

function serializarPunto(punto) {
  return {
    _id: punto._id?.toString(),
    nombre: punto.nombre || "Punto sin nombre",
    descripcion: punto.descripcion || "",
    direccion: punto.direccion || "",
    categoria: punto.categoria || null,
    foto: punto.foto || "",
    lat: punto.lat,
    lon: punto.lon,
    ubicacion: punto.ubicacion || null,
    vista360: punto.vista360 || null,
  };
}

function serializarRuta(ruta, puntos = []) {
  if (!ruta) return null;

  return {
    _id: ruta._id?.toString(),
    nombre: ruta.nombre || "Ruta sin nombre",
    descripcion: ruta.descripcion || "",
    categoria: ruta.categoria,
    puntos: puntos.map(serializarPunto),
    puntosIds: (ruta.puntos || []).map((id) => id.toString()),
    cantidadPuntos: ruta.cantidadPuntos || ruta.puntos?.length || 0,
    activa: ruta.activa !== false,
    destacada: Boolean(ruta.destacada),
    versionPuntos: ruta.versionPuntos || 1,
    creadoPor: ruta.creadoPor?.toString(),
    createdAt: ruta.createdAt,
    updatedAt: ruta.updatedAt,
  };
}

function serializarRutaResumen(ruta) {
  if (!ruta) return null;

  return {
    _id: ruta._id?.toString(),
    nombre: ruta.nombre || "Ruta sin nombre",
    descripcion: ruta.descripcion || "",
    categoria: ruta.categoria,
    cantidadPuntos: ruta.cantidadPuntos || ruta.puntos?.length || 0,
    activa: ruta.activa !== false,
    destacada: Boolean(ruta.destacada),
    versionPuntos: ruta.versionPuntos || 1,
  };
}

async function expandirRuta(ruta) {
  if (!ruta) return null;

  const puntos = await servicePuntos.getPuntosByIds(ruta.puntos || []);
  const puntosPorId = new Map(puntos.map((punto) => [punto._id.toString(), punto]));
  const puntosOrdenados = (ruta.puntos || [])
    .map((id) => puntosPorId.get(id.toString()))
    .filter(Boolean);

  return serializarRuta(ruta, puntosOrdenados);
}

function normalizarBoolean(valor, defaultValue = false) {
  if (valor === undefined) return defaultValue;
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "string") return valor.toLowerCase() === "true";
  return Boolean(valor);
}

function getFiltroPublico(query = {}, { incluirInactivas = false } = {}) {
  const filtro = {};

  if (!incluirInactivas) {
    filtro.activa = { $ne: false };
  }

  if (query.categoria && query.categoria !== "todas") {
    filtro.categoria = validarCategoria(query.categoria);
  }

  if (query.destacada !== undefined) {
    filtro.destacada = normalizarBoolean(query.destacada);
  }

  if (query.q && String(query.q).trim()) {
    const texto = String(query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filtro.nombre = new RegExp(texto, "i");
  }

  return filtro;
}

export async function asegurarIndicesRutas() {
  await collection().createIndex(
    { categoria: 1, activa: 1 },
    { name: "ruta_categoria_activa" }
  );

  await collection().createIndex(
    { destacada: 1, activa: 1 },
    { name: "ruta_destacada_activa" }
  );

  await realizadasCollection().createIndex(
    { idUsuario: 1, idRuta: 1, versionPuntos: 1, modo: 1 },
    { unique: true, name: "usuario_ruta_version_modo_unico" }
  );

  await realizadasCollection().createIndex(
    { idUsuario: 1, fechaUltimaCompletada: -1 },
    { name: "usuario_rutas_realizadas_fecha" }
  );

  await progresosCollection().createIndex(
    { idUsuario: 1, idRuta: 1, versionPuntos: 1, modo: 1 },
    { unique: true, name: "usuario_ruta_progreso_version_modo_unico" }
  );

  await progresosCollection().createIndex(
    { idUsuario: 1, updatedAt: -1 },
    { name: "usuario_rutas_progreso_fecha" }
  );
}

export async function getRutas(query = {}, options = {}) {
  const filtro = getFiltroPublico(query, options);
  const rutas = await collection()
    .find(filtro)
    .sort({ destacada: -1, updatedAt: -1, nombre: 1 })
    .toArray();

  return Promise.all(rutas.map(expandirRuta));
}

export async function getRutasConEstadoUsuario(idUsuario, query = {}) {
  const filtro = getFiltroPublico(query);
  const rutas = await collection()
    .find(filtro)
    .sort({ destacada: -1, updatedAt: -1, nombre: 1 })
    .toArray();

  if (rutas.length === 0) return [];

  const idUsuarioObject = toObjectId(idUsuario, "idUsuario");
  const realizadas = await realizadasCollection()
    .find({
      idUsuario: idUsuarioObject,
      idRuta: { $in: rutas.map((ruta) => ruta._id) },
    })
    .sort({ fechaUltimaCompletada: -1 })
    .toArray();

  const realizadasPorRuta = new Map();
  realizadas.forEach((realizada) => {
    const idRuta = realizada.idRuta.toString();
    const lista = realizadasPorRuta.get(idRuta) || [];
    lista.push(realizada);
    realizadasPorRuta.set(idRuta, lista);
  });

  const progresos = await progresosCollection()
    .find({
      idUsuario: idUsuarioObject,
      idRuta: { $in: rutas.map((ruta) => ruta._id) },
    })
    .sort({ updatedAt: -1 })
    .toArray();

  const progresosPorRuta = new Map();
  progresos.forEach((progreso) => {
    const idRuta = progreso.idRuta.toString();
    if (!progresosPorRuta.has(idRuta)) {
      progresosPorRuta.set(idRuta, progreso);
    }
  });

  return Promise.all(
    rutas.map(async (ruta) => ({
      ...(await expandirRuta(ruta)),
      estadoUsuario: getEstadoUsuarioDesdeRealizaciones(
        ruta,
        realizadasPorRuta.get(ruta._id.toString()) || [],
        progresosPorRuta.get(ruta._id.toString()) || null
      ),
    }))
  );
}

export async function getRutaById(id, { incluirInactivas = false } = {}) {
  const filtro = { _id: toObjectId(id, "idRuta") };

  if (!incluirInactivas) {
    filtro.activa = { $ne: false };
  }

  return expandirRuta(await collection().findOne(filtro));
}

export async function crearRuta(data, idAdmin) {
  const puntosIds = normalizarPuntosIds(data.puntos);
  await validarPuntosExistentes(puntosIds);

  const ahora = new Date();
  const ruta = {
    nombre: normalizarTexto(data.nombre, { requerido: true, max: 120 }),
    descripcion: normalizarTexto(data.descripcion, { max: 800 }),
    categoria: validarCategoria(data.categoria),
    puntos: puntosIds,
    cantidadPuntos: puntosIds.length,
    puntosHash: getPuntosHash(puntosIds),
    versionPuntos: 1,
    activa: data.activa !== false,
    destacada: normalizarBoolean(data.destacada),
    creadoPor: toObjectId(idAdmin, "idAdmin"),
    createdAt: ahora,
    updatedAt: ahora,
  };

  const resultado = await collection().insertOne(ruta);
  return getRutaById(resultado.insertedId, { incluirInactivas: true });
}

export async function editarRuta(id, data) {
  const idRuta = toObjectId(id, "idRuta");
  const rutaActual = await collection().findOne({ _id: idRuta });
  if (!rutaActual) throw crearError("Ruta no encontrada", 404);

  const set = { updatedAt: new Date() };
  const update = { $set: set };

  if (data.nombre !== undefined) {
    set.nombre = normalizarTexto(data.nombre, { requerido: true, max: 120 });
  }

  if (data.descripcion !== undefined) {
    set.descripcion = normalizarTexto(data.descripcion, { max: 800 });
  }

  if (data.categoria !== undefined) {
    set.categoria = validarCategoria(data.categoria);
  }

  if (data.activa !== undefined) {
    set.activa = normalizarBoolean(data.activa, rutaActual.activa !== false);
  }

  if (data.destacada !== undefined) {
    set.destacada = normalizarBoolean(data.destacada);
  }

  if (data.puntos !== undefined) {
    const puntosIds = normalizarPuntosIds(data.puntos);
    await validarPuntosExistentes(puntosIds);

    const puntosHash = getPuntosHash(puntosIds);
    set.puntos = puntosIds;
    set.cantidadPuntos = puntosIds.length;
    set.puntosHash = puntosHash;

    if (puntosHash !== rutaActual.puntosHash) {
      update.$inc = { versionPuntos: 1 };
    }
  }

  const resultado = await collection().findOneAndUpdate(
    { _id: idRuta },
    update,
    { returnDocument: "after" }
  );

  return expandirRuta(resultado);
}

export async function eliminarRuta(id) {
  return collection().deleteOne({ _id: toObjectId(id, "idRuta") });
}

function normalizarModoRuta(modo, ruta) {
  const value = String(modo || "corta").trim().toLowerCase();

  if (!MODOS_RUTA.has(value)) {
    throw crearError("Modo de ruta invalido");
  }

  if (value === "larga" && (ruta.puntos || []).length <= 3) {
    throw crearError("La ruta larga solo esta disponible con mas de 3 puntos");
  }

  return value;
}

function normalizarPuntosCompletados(puntosCompletados = [], ruta) {
  if (!Array.isArray(puntosCompletados)) {
    throw crearError("Los puntos completados deben enviarse en una lista");
  }

  if (puntosCompletados.length === 0) {
    return [];
  }

  const idsUnicos = new Map();
  puntosCompletados.forEach((punto) => {
    const id = toObjectId(punto, "idPunto");
    idsUnicos.set(id.toString(), id);
  });

  const ids = [...idsUnicos.values()];
  const puntosRuta = new Set((ruta.puntos || []).map((id) => id.toString()));
  const fueraDeRuta = ids
    .map((id) => id.toString())
    .filter((id) => !puntosRuta.has(id));

  if (fueraDeRuta.length > 0) {
    throw crearError("Los puntos completados deben pertenecer a la ruta", 400, {
      puntosInvalidos: fueraDeRuta,
    });
  }

  return ids;
}

function validarPuntosCompletadosParaModo(ruta, modo, puntosCompletadosIds) {
  if (puntosCompletadosIds.length < 3) {
    throw crearError("Para completar una ruta tenes que pasar por minimo 3 puntos");
  }

  if (modo !== "larga") return;

  const completados = new Set(puntosCompletadosIds.map((id) => id.toString()));
  const faltantes = (ruta.puntos || [])
    .map((id) => id.toString())
    .filter((id) => !completados.has(id));

  if (faltantes.length > 0) {
    throw crearError("Para completar una ruta larga tenes que pasar por todos los puntos", 400, {
      puntosInvalidos: faltantes,
    });
  }
}

function getPuntosNuevos(ruta, realizada) {
  if (!ruta || !realizada) return [];

  const puntosSnapshot = new Set(
    (realizada.puntosRuta || []).map((id) => id.toString())
  );

  return (ruta.puntos || [])
    .map((id) => id.toString())
    .filter((id) => !puntosSnapshot.has(id));
}

function serializarRealizacion(realizada, rutaActual = null) {
  if (!realizada) return null;

  const puntosNuevos = rutaActual ? getPuntosNuevos(rutaActual, realizada) : [];

  return {
    _id: realizada._id?.toString(),
    idRuta: realizada.idRuta?.toString(),
    modo: realizada.modo,
    veces: realizada.veces || 1,
    versionPuntos: realizada.versionPuntos,
    versionActual: rutaActual?.versionPuntos || null,
    actualizada: puntosNuevos.length > 0,
    puntosNuevos,
    fechaPrimeraCompletada: realizada.fechaPrimeraCompletada,
    fechaUltimaCompletada: realizada.fechaUltimaCompletada,
    ruta: rutaActual
      ? serializarRutaResumen(rutaActual)
      : {
          _id: realizada.idRuta?.toString(),
          nombre: realizada.nombreRuta || "Ruta no disponible",
          categoria: realizada.categoriaRuta || null,
          cantidadPuntos: realizada.puntosRuta?.length || 0,
          eliminada: true,
        },
  };
}

function serializarProgreso(progreso, rutaActual = null) {
  if (!progreso) return null;

  const puntosNuevos = rutaActual ? getPuntosNuevos(rutaActual, progreso) : [];
  const versionActual = rutaActual?.versionPuntos || null;

  return {
    _id: progreso._id?.toString(),
    idRuta: progreso.idRuta?.toString(),
    modo: progreso.modo,
    estado: progreso.estado || "pausada",
    puntosCompletados: (progreso.puntosCompletados || []).map((id) =>
      id.toString()
    ),
    totalCompletados: progreso.puntosCompletados?.length || 0,
    versionPuntos: progreso.versionPuntos,
    versionActual,
    versionDesactualizada: versionActual
      ? progreso.versionPuntos !== versionActual
      : false,
    actualizada: puntosNuevos.length > 0,
    puntosNuevos,
    fechaInicio: progreso.fechaInicio,
    fechaPausa: progreso.fechaPausa,
    updatedAt: progreso.updatedAt,
  };
}

function getEstadoUsuarioDesdeRealizaciones(ruta, realizadas = [], progreso = null) {
  const ultima = realizadas[0] || null;
  const versionActual = ruta.versionPuntos || 1;
  const modosVersionActual = realizadas
    .filter((item) => item.versionPuntos === versionActual)
    .map((item) => item.modo);
  const puntosNuevos = ultima ? getPuntosNuevos(ruta, ultima) : [];
  const progresoSerializado = serializarProgreso(progreso, ruta);

  return {
    realizada: Boolean(ultima),
    realizadaVersionActual: modosVersionActual.length > 0,
    modosRealizadosVersionActual: modosVersionActual,
    actualizada: puntosNuevos.length > 0,
    debeRehacer: puntosNuevos.length > 0,
    puntosNuevos,
    versionActual,
    versionRealizada: ultima?.versionPuntos || null,
    ultimaRealizacion: serializarRealizacion(ultima, ruta),
    pausada: Boolean(progresoSerializado),
    puedeRetomar: Boolean(
      progresoSerializado && !progresoSerializado.versionDesactualizada
    ),
    progreso: progresoSerializado,
  };
}

export async function registrarRutaRealizada({
  idUsuario,
  idRuta,
  modo = "corta",
  puntosCompletados = [],
}) {
  const idUsuarioObject = toObjectId(idUsuario, "idUsuario");
  const ruta = await collection().findOne({
    _id: toObjectId(idRuta, "idRuta"),
    activa: { $ne: false },
  });

  if (!ruta) throw crearError("Ruta no encontrada", 404);

  const modoNormalizado = normalizarModoRuta(modo, ruta);
  const puntosCompletadosIds = normalizarPuntosCompletados(puntosCompletados, ruta);
  validarPuntosCompletadosParaModo(ruta, modoNormalizado, puntosCompletadosIds);
  const ahora = new Date();

  const resultado = await realizadasCollection().findOneAndUpdate(
    {
      idUsuario: idUsuarioObject,
      idRuta: ruta._id,
      versionPuntos: ruta.versionPuntos || 1,
      modo: modoNormalizado,
    },
    {
      $set: {
        fechaUltimaCompletada: ahora,
        updatedAt: ahora,
      },
      $setOnInsert: {
        idUsuario: idUsuarioObject,
        idRuta: ruta._id,
        modo: modoNormalizado,
        versionPuntos: ruta.versionPuntos || 1,
        puntosHash: ruta.puntosHash,
        puntosRuta: ruta.puntos || [],
        puntosCompletados: puntosCompletadosIds,
        nombreRuta: ruta.nombre,
        categoriaRuta: ruta.categoria,
        fechaPrimeraCompletada: ahora,
        createdAt: ahora,
      },
      $inc: { veces: 1 },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  await progresosCollection().deleteMany({
    idUsuario: idUsuarioObject,
    idRuta: ruta._id,
    modo: modoNormalizado,
  });

  return serializarRealizacion(resultado, ruta);
}

export async function guardarProgresoRuta({
  idUsuario,
  idRuta,
  modo = "corta",
  puntosCompletados = [],
  estado = "pausada",
}) {
  const idUsuarioObject = toObjectId(idUsuario, "idUsuario");
  const ruta = await collection().findOne({
    _id: toObjectId(idRuta, "idRuta"),
    activa: { $ne: false },
  });

  if (!ruta) throw crearError("Ruta no encontrada", 404);

  const modoNormalizado = normalizarModoRuta(modo, ruta);
  const puntosCompletadosIds = normalizarPuntosCompletados(puntosCompletados, ruta);
  const estadoNormalizado = estado === "en_progreso" ? "en_progreso" : "pausada";
  const ahora = new Date();

  const resultado = await progresosCollection().findOneAndUpdate(
    {
      idUsuario: idUsuarioObject,
      idRuta: ruta._id,
      versionPuntos: ruta.versionPuntos || 1,
      modo: modoNormalizado,
    },
    {
      $set: {
        estado: estadoNormalizado,
        puntosCompletados: puntosCompletadosIds,
        fechaPausa: estadoNormalizado === "pausada" ? ahora : null,
        updatedAt: ahora,
      },
      $setOnInsert: {
        idUsuario: idUsuarioObject,
        idRuta: ruta._id,
        modo: modoNormalizado,
        versionPuntos: ruta.versionPuntos || 1,
        puntosHash: ruta.puntosHash,
        puntosRuta: ruta.puntos || [],
        nombreRuta: ruta.nombre,
        categoriaRuta: ruta.categoria,
        fechaInicio: ahora,
        createdAt: ahora,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  return serializarProgreso(resultado, ruta);
}

export async function getProgresoRutaUsuario(idUsuario, idRuta, modo = null) {
  const ruta = await collection().findOne({
    _id: toObjectId(idRuta, "idRuta"),
    activa: { $ne: false },
  });

  if (!ruta) throw crearError("Ruta no encontrada", 404);

  const filtro = {
    idUsuario: toObjectId(idUsuario, "idUsuario"),
    idRuta: ruta._id,
  };

  if (modo) {
    filtro.modo = normalizarModoRuta(modo, ruta);
  }

  const progreso = await progresosCollection()
    .find(filtro)
    .sort({ updatedAt: -1 })
    .limit(1)
    .next();

  return serializarProgreso(progreso, ruta);
}

export async function descartarProgresoRuta(idUsuario, idRuta, modo = null) {
  const ruta = await collection().findOne({
    _id: toObjectId(idRuta, "idRuta"),
    activa: { $ne: false },
  });

  if (!ruta) throw crearError("Ruta no encontrada", 404);

  const filtro = {
    idUsuario: toObjectId(idUsuario, "idUsuario"),
    idRuta: ruta._id,
  };

  if (modo) {
    filtro.modo = normalizarModoRuta(modo, ruta);
  }

  return progresosCollection().deleteMany(filtro);
}

export async function getEstadoRutaUsuario(idUsuario, idRuta) {
  const ruta = await collection().findOne({
    _id: toObjectId(idRuta, "idRuta"),
    activa: { $ne: false },
  });

  if (!ruta) throw crearError("Ruta no encontrada", 404);

  const realizadas = await realizadasCollection()
    .find({
      idUsuario: toObjectId(idUsuario, "idUsuario"),
      idRuta: ruta._id,
    })
    .sort({ fechaUltimaCompletada: -1 })
    .toArray();

  const progreso = await progresosCollection()
    .find({
      idUsuario: toObjectId(idUsuario, "idUsuario"),
      idRuta: ruta._id,
    })
    .sort({ updatedAt: -1 })
    .limit(1)
    .next();

  return {
    idRuta: ruta._id.toString(),
    ...getEstadoUsuarioDesdeRealizaciones(ruta, realizadas, progreso),
  };
}

export async function getRutasRealizadasUsuario(idUsuario) {
  const realizadas = await realizadasCollection()
    .find({ idUsuario: toObjectId(idUsuario, "idUsuario") })
    .sort({ fechaUltimaCompletada: -1 })
    .toArray();

  if (realizadas.length === 0) return [];

  const idsRutas = [...new Set(realizadas.map((item) => item.idRuta.toString()))].map(
    (id) => new ObjectId(id)
  );
  const rutas = await collection()
    .find({ _id: { $in: idsRutas } })
    .toArray();
  const rutasPorId = new Map(rutas.map((ruta) => [ruta._id.toString(), ruta]));

  return realizadas.map((realizada) =>
    serializarRealizacion(realizada, rutasPorId.get(realizada.idRuta.toString()))
  );
}
