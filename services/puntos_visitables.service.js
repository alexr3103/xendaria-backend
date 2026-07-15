import { ObjectId } from "mongodb";
import { getDB } from "./db.js";

// Acceso directo a la colección
function collection() {
  const db = getDB();
  return db.collection("puntos_visitables");
}

export async function asegurarIndiceGeografico() {
  await collection().createIndex(
    { ubicacion: "2dsphere" },
    {
      name: "ubicacion_2dsphere",
      partialFilterExpression: { "ubicacion.type": "Point" },
    }
  );

  return collection().createIndex(
    { claveDuplicado: 1 },
    {
      name: "claveDuplicado_1",
      partialFilterExpression: { claveDuplicado: { $type: "string" } },
    }
  );
}

export async function completarUbicacionesGeoJson() {
  return collection().updateMany(
    {
      lat: { $exists: true },
      lon: { $exists: true },
    },
    [
      {
        $set: {
          __latNumber: {
            $convert: {
              input: "$lat",
              to: "double",
              onError: null,
              onNull: null,
            },
          },
          __lonNumber: {
            $convert: {
              input: "$lon",
              to: "double",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $set: {
          lat: { $ifNull: ["$__latNumber", "$lat"] },
          lon: { $ifNull: ["$__lonNumber", "$lon"] },
          ubicacion: {
            $cond: [
              {
                $and: [
                  { $ne: ["$__latNumber", null] },
                  { $ne: ["$__lonNumber", null] },
                ],
              },
              {
                type: "Point",
                coordinates: ["$__lonNumber", "$__latNumber"],
              },
              "$ubicacion",
            ],
          },
        },
      },
      { $unset: ["__latNumber", "__lonNumber"] },
    ]
  );
}

export async function completarMetadatosPuntos() {
  const puntos = await collection().find({}).toArray();
  const operaciones = puntos
    .map((punto) => {
      const preparado = prepararPuntoParaGuardar(punto);
      const set = {};

      if (preparado.categoria !== punto.categoria) {
        set.categoria = preparado.categoria;
      }

      if (
        JSON.stringify(preparado.categorias || []) !==
        JSON.stringify(punto.categorias || [])
      ) {
        set.categorias = preparado.categorias || [];
      }

      if (preparado.claveDuplicado && preparado.claveDuplicado !== punto.claveDuplicado) {
        set.claveDuplicado = preparado.claveDuplicado;
      }

      if (Object.keys(set).length === 0) return null;

      return {
        updateOne: {
          filter: { _id: punto._id },
          update: { $set: set },
        },
      };
    })
    .filter(Boolean);

  if (operaciones.length === 0) {
    return { modifiedCount: 0 };
  }

  return collection().bulkWrite(operaciones, { ordered: false });
}

function _escapeRegex(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function _expandDiacritics(s = "") {
  const map = {
    a: "[aáàäâãå]", A: "[AÁÀÄÂÃÅ]",
    e: "[eéèëê]",   E: "[EÉÈËÊ]",
    i: "[iíìïî]",   I: "[IÍÌÏÎ]",
    o: "[oóòöôõ]",  O: "[OÓÒÖÔÕ]",
    u: "[uúùüû]",   U: "[UÚÙÜÛ]",
    n: "[nñ]",      N: "[NÑ]",
    c: "[cç]",      C: "[CÇ]",
  };
  const esc = _escapeRegex(s);
  return esc.replace(/[aeiouncAEIOUNC]/g, ch => map[ch] || ch);
}
function buildFuzzyRegexes(text = "") {
  const t = text.trim();
  if (!t) return [];
  const base = _expandDiacritics(t);
  const regs = [];
  regs.push(new RegExp(base, "i"));
  for (let i = 0; i < t.length; i++) {
    const before = _expandDiacritics(t.slice(0, i));
    const after  = _expandDiacritics(t.slice(i + 1));
    regs.push(new RegExp(before + "." + after, "i"));
  }
  for (let i = 0; i < t.length; i++) {
    const omit = _expandDiacritics(t.slice(0, i) + t.slice(i + 1));
    regs.push(new RegExp(omit, "i"));
  }
  regs.push(new RegExp("^" + base, "i"));
  return regs;
}

const COORD_DUPLICADA_TOLERANCIA = 0.00005;

function normalizarCategoriasPunto(punto = {}) {
  const valores = [
    ...(Array.isArray(punto.categorias) ? punto.categorias : []),
    punto.categoria,
  ];
  const categoriasUnicas = new Set();

  valores.forEach((valor) => {
    const categoria = String(valor || "").trim();
    if (categoria) categoriasUnicas.add(categoria);
  });

  return [...categoriasUnicas];
}

function prepararPuntoParaGuardar(punto = {}) {
  const puntoAGuardar = { ...punto };
  const categorias = normalizarCategoriasPunto(puntoAGuardar);
  const claveDuplicado = crearClaveDuplicado(puntoAGuardar);

  if (puntoAGuardar.activo === undefined) {
    puntoAGuardar.activo = true;
  }

  if (categorias.length > 0) {
    puntoAGuardar.categoria = puntoAGuardar.categoria || categorias[0];
    puntoAGuardar.categorias = categorias;
  }

  if (claveDuplicado) {
    puntoAGuardar.claveDuplicado = claveDuplicado;
  }

  return puntoAGuardar;
}

function normalizarNombreDuplicado(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getCoordenadasPunto(punto = {}) {
  const lat = Number(punto.lat ?? punto.ubicacion?.coordinates?.[1]);
  const lon = Number(punto.lon ?? punto.ubicacion?.coordinates?.[0]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return { lat, lon };
}

export function crearClaveDuplicado(punto = {}) {
  const nombre = normalizarNombreDuplicado(punto.nombre);
  const coords = getCoordenadasPunto(punto);

  if (!nombre || !coords) {
    return null;
  }

  return `${nombre}:${coords.lon.toFixed(5)}:${coords.lat.toFixed(5)}`;
}

export async function buscarPuntoDuplicado(punto = {}, { excluirId = null } = {}) {
  const claveDuplicado = crearClaveDuplicado(punto);
  const nombreNormalizado = normalizarNombreDuplicado(punto.nombre);
  const coords = getCoordenadasPunto(punto);

  if (!claveDuplicado || !nombreNormalizado || !coords) {
    return null;
  }

  const filtro = {
    creadoPor: { $exists: false },
    $or: [
      { claveDuplicado },
      {
        lat: {
          $gte: coords.lat - COORD_DUPLICADA_TOLERANCIA,
          $lte: coords.lat + COORD_DUPLICADA_TOLERANCIA,
        },
        lon: {
          $gte: coords.lon - COORD_DUPLICADA_TOLERANCIA,
          $lte: coords.lon + COORD_DUPLICADA_TOLERANCIA,
        },
      },
    ],
  };

  if (excluirId) {
    filtro._id = { $ne: new ObjectId(excluirId) };
  }

  const candidatos = await collection()
    .find(filtro)
    .project({ nombre: 1, lat: 1, lon: 1, ubicacion: 1, claveDuplicado: 1 })
    .limit(20)
    .toArray();

  return candidatos.find((candidato) => {
    if (candidato.claveDuplicado === claveDuplicado) {
      return true;
    }

    const coordsCandidato = getCoordenadasPunto(candidato);
    if (!coordsCandidato) {
      return false;
    }

    return (
      normalizarNombreDuplicado(candidato.nombre) === nombreNormalizado &&
      Math.abs(coordsCandidato.lat - coords.lat) <= COORD_DUPLICADA_TOLERANCIA &&
      Math.abs(coordsCandidato.lon - coords.lon) <= COORD_DUPLICADA_TOLERANCIA
    );
  }) || null;
}

//servicios principales
export async function getPuntos(filter = {}) {
  const filterMongo = {
    creadoPor: { $exists: false },
  };
  const condiciones = [];
  const estado = String(filter.estado || "").toLowerCase();
  const incluirInactivos = filter.incluirInactivos === true;

  if (estado === "inactivos" || estado === "inactivo") {
    condiciones.push({ activo: false });
  } else if (estado === "activos" || estado === "activo" || !incluirInactivos) {
    condiciones.push({ activo: { $ne: false } });
  }

  if (
    filter.categoria &&
    filter.categoria !== "Todos" &&
    filter.categoria !== "todas"
  ) {
    const categoria = String(filter.categoria);
    condiciones.push({
      $or: [
        { categoria },
        { categorias: categoria },
      ],
    });
  }

  if (filter.nombreContiene && String(filter.nombreContiene).trim() !== "") {
    const regs = buildFuzzyRegexes(String(filter.nombreContiene));
    condiciones.push({
      $or: regs.map(rx => ({ nombre: rx })),
    });
  }

  if (condiciones.length > 0) {
    filterMongo.$and = condiciones;
  }

  return collection().find(filterMongo).toArray();
}

export async function getPuntosById(id, options = {}) {
  const filtro = {
    _id: new ObjectId(id),
    creadoPor: { $exists: false },
  };

  if (!options.incluirInactivos) {
    filtro.activo = { $ne: false };
  }

  return collection().findOne(filtro);
}

export async function getPuntosByIds(ids = []) {
  return collection()
    .find({
      _id: { $in: ids },
      creadoPor: { $exists: false },
    })
    .toArray();
}

export async function getPuntosPropiosPorUsuario(idUsuario) {
  return collection()
    .find({
      creadoPor: new ObjectId(idUsuario),
      visibilidad: "privado",
    })
    .toArray();
}

export async function getPuntoPropioById(idUsuario, idPunto) {
  return collection().findOne({
    _id: new ObjectId(idPunto),
    creadoPor: new ObjectId(idUsuario),
    visibilidad: "privado",
  });
}

export async function eliminarPuntoPropio(idUsuario, idPunto) {
  return collection().deleteOne({
    _id: new ObjectId(idPunto),
    creadoPor: new ObjectId(idUsuario),
    visibilidad: "privado",
  });
}

export async function eliminarPuntosPropiosPorUsuario(idUsuario) {
  return collection().deleteMany({
    creadoPor: new ObjectId(idUsuario),
    visibilidad: "privado",
  });
}

export async function guardarPunto(punto) {
  const puntoAGuardar = prepararPuntoParaGuardar(punto);
  return collection().insertOne(puntoAGuardar);
}

export async function reemplazarPunto(id, punto) {
  const puntoAGuardar = prepararPuntoParaGuardar(punto);
  return collection().replaceOne({ _id: new ObjectId(id) }, puntoAGuardar);
}

export async function eliminarPunto(id) {
  return collection().deleteOne({ _id: new ObjectId(id) });
}

export async function editarPunto(id, punto) {
  const data = { ...punto };
  const categorias = normalizarCategoriasPunto(data);

  if (categorias.length > 0) {
    data.categoria = data.categoria || categorias[0];
    data.categorias = categorias;
  }

  if (
    data.nombre !== undefined ||
    data.lat !== undefined ||
    data.lon !== undefined ||
    data.ubicacion !== undefined
  ) {
    const actual = await collection().findOne({ _id: new ObjectId(id) });
    const claveDuplicado = crearClaveDuplicado({ ...actual, ...data });

    if (claveDuplicado) {
      data.claveDuplicado = claveDuplicado;
    }
  }

  return collection().updateOne({ _id: new ObjectId(id) }, { $set: data });
}

function mergeArrayPorClave(arrays = [], getKey = (item) => JSON.stringify(item)) {
  const resultado = new Map();

  arrays.flat().filter(Boolean).forEach((item) => {
    const key = getKey(item);
    if (!resultado.has(key)) resultado.set(key, item);
  });

  return [...resultado.values()];
}

function elegirTextoPrincipal(...valores) {
  return valores
    .filter((valor) => typeof valor === "string" && valor.trim())
    .sort((a, b) => b.length - a.length)[0] || "";
}

function fusionarDatosPunto(principal = {}, puntos = []) {
  const todos = [principal, ...puntos].filter(Boolean);
  const categorias = mergeArrayPorClave(
    todos.map((punto) => normalizarCategoriasPunto(punto)),
    (categoria) => categoria
  );
  const insignia = todos.find((punto) => punto.insignia)?.insignia || null;
  const vista360 = todos.find((punto) => punto.vista360?.ultimaVerificacion)?.vista360 ||
    principal.vista360 ||
    todos.find((punto) => punto.vista360)?.vista360 ||
    null;

  return prepararPuntoParaGuardar({
    ...principal,
    categoria: principal.categoria || categorias[0] || "",
    categorias,
    descripcion: elegirTextoPrincipal(...todos.map((punto) => punto.descripcion)),
    descripcion_completa: elegirTextoPrincipal(
      ...todos.map((punto) => punto.descripcion_completa)
    ),
    direccion: principal.direccion || todos.find((punto) => punto.direccion)?.direccion || "",
    foto: principal.foto || todos.find((punto) => punto.foto)?.foto || "",
    insignia,
    vista360,
    fotos: mergeArrayPorClave(
      todos.map((punto) => punto.fotos || []),
      (foto) => foto.publicId || foto.url
    ),
    multimedia: mergeArrayPorClave(
      todos.map((punto) => punto.multimedia || []),
      (item) => item._id?.toString?.() || item.url || JSON.stringify(item)
    ),
    historias: mergeArrayPorClave(
      todos.map((punto) => punto.historias || []),
      (historia) => `${historia.titulo || ""}:${historia.contenido || ""}`
    ).slice(0, 3),
    fusionadoDesde: mergeArrayPorClave(
      [
        principal.fusionadoDesde || [],
        puntos
          .filter((punto) => punto._id)
          .map((punto) => ({
            idOriginal: punto._id,
            nombre: punto.nombre,
            categoria: punto.categoria,
            categorias: normalizarCategoriasPunto(punto),
            fechaFusion: new Date(),
          })),
      ],
      (item) => item.idOriginal?.toString?.() || String(item.idOriginal)
    ),
    updatedAt: new Date(),
  });
}

function quitarId(data = {}) {
  const { _id, ...resto } = data;
  return resto;
}

function reemplazarIdsEnArray(lista = [], idViejo, idPrincipal) {
  return mergeArrayPorClave(
    lista.map((id) => id?.toString?.() === idViejo.toString() ? idPrincipal : id),
    (id) => id?.toString?.() || String(id)
  );
}

function getPuntosHash(ids = []) {
  return ids
    .map((id) => id.toString())
    .sort()
    .join("|");
}

async function reemplazarReferenciasPunto(idViejo, idPrincipal) {
  const db = getDB();

  const rutas = await db.collection("rutas_recomendadas")
    .find({ puntos: idViejo })
    .toArray();

  for (const ruta of rutas) {
    const puntos = reemplazarIdsEnArray(ruta.puntos || [], idViejo, idPrincipal);
    await db.collection("rutas_recomendadas").updateOne(
      { _id: ruta._id },
      {
        $set: {
          puntos,
          cantidadPuntos: puntos.length,
          puntosHash: getPuntosHash(puntos),
          updatedAt: new Date(),
        },
        $inc: { versionPuntos: 1 },
      }
    );
  }

  for (const nombreColeccion of ["rutas_realizadas", "rutas_progreso"]) {
    const documentos = await db.collection(nombreColeccion)
      .find({
        $or: [
          { puntosRuta: idViejo },
          { puntosCompletados: idViejo },
        ],
      })
      .toArray();

    for (const documento of documentos) {
      await db.collection(nombreColeccion).updateOne(
        { _id: documento._id },
        {
          $set: {
            puntosRuta: reemplazarIdsEnArray(documento.puntosRuta || [], idViejo, idPrincipal),
            puntosCompletados: reemplazarIdsEnArray(
              documento.puntosCompletados || [],
              idViejo,
              idPrincipal
            ),
          },
        }
      );
    }
  }

  const usuarios = await db.collection("usuarios").find({
    $or: [
      { lugares_favoritos: idViejo },
      { "puntos_visitados.idPunto": idViejo },
      { "puntos_visitados.punto": idViejo },
      { "puntos_visitados.puntoId": idViejo },
      { insignias: idViejo },
      { "insignias.idPunto": idViejo },
      { "insignias.punto": idViejo },
      { "insignias.puntoId": idViejo },
    ],
  }).toArray();

  for (const usuario of usuarios) {
    const favoritos = mergeArrayPorClave(
      (usuario.lugares_favoritos || []).map((id) =>
        id?.toString?.() === idViejo.toString() ? idPrincipal : id
      ),
      (id) => id?.toString?.() || String(id)
    );
    const puntosVisitados = mergeArrayPorClave(
      (usuario.puntos_visitados || []).map((visita) => {
        if (visita?.idPunto?.toString?.() === idViejo.toString()) {
          return { ...visita, idPunto: idPrincipal };
        }
        return visita;
      }),
      (visita) => visita?.idPunto?.toString?.() || visita?.toString?.() || String(visita)
    );
    const insignias = mergeArrayPorClave(
      (usuario.insignias || []).map((insignia) => {
        if (insignia?.idPunto?.toString?.() === idViejo.toString()) {
          return { ...insignia, idPunto: idPrincipal };
        }
        return insignia?.toString?.() === idViejo.toString() ? idPrincipal : insignia;
      }),
      (insignia) => insignia?.idPunto?.toString?.() || insignia?.toString?.() || String(insignia)
    );

    await db.collection("usuarios").updateOne(
      { _id: usuario._id },
      { $set: { lugares_favoritos: favoritos, puntos_visitados: puntosVisitados, insignias } }
    );
  }

  const visitasViejas = await db.collection("visitas").find({ idPunto: idViejo }).toArray();
  for (const visita of visitasViejas) {
    const visitaSinId = quitarId(visita);
    await db.collection("visitas").updateOne(
      { idUsuario: visita.idUsuario, idPunto: idPrincipal },
      {
        $setOnInsert: {
          ...visitaSinId,
          idPunto: idPrincipal,
        },
      },
      { upsert: true }
    );
  }
  await db.collection("visitas").deleteMany({ idPunto: idViejo });

  const calificacionesViejas = await db.collection("calificaciones").find({ idPunto: idViejo }).toArray();
  for (const calificacion of calificacionesViejas) {
    const existente = await db.collection("calificaciones").findOne({
      idUsuario: calificacion.idUsuario,
      idPunto: idPrincipal,
    });

    if (!existente) {
      await db.collection("calificaciones").insertOne({
        ...calificacion,
        _id: new ObjectId(),
        idPunto: idPrincipal,
      });
    } else {
      const fechaExistente = new Date(existente.updatedAt || existente.fechaCalificacion || 0);
      const fechaVieja = new Date(calificacion.updatedAt || calificacion.fechaCalificacion || 0);
      if (fechaVieja > fechaExistente) {
        await db.collection("calificaciones").updateOne(
          { _id: existente._id },
          { $set: { estrellas: calificacion.estrellas, updatedAt: calificacion.updatedAt || new Date() } }
        );
      }
    }
  }
  await db.collection("calificaciones").deleteMany({ idPunto: idViejo });
}

export async function fusionarPuntoEnPrincipal(idPrincipal, puntoEntrante) {
  const principal = await collection().findOne({ _id: new ObjectId(idPrincipal) });
  if (!principal) return null;

  const fusionado = fusionarDatosPunto(principal, [puntoEntrante]);
  await collection().updateOne(
    { _id: principal._id },
    { $set: quitarId(fusionado) }
  );

  return collection().findOne({ _id: principal._id });
}

export async function listarDuplicadosPublicos() {
  const puntos = await collection()
    .find({ creadoPor: { $exists: false } })
    .sort({ nombre: 1 })
    .toArray();
  const grupos = new Map();

  puntos.forEach((punto) => {
    const clave = crearClaveDuplicado(punto);
    if (!clave) return;
    const lista = grupos.get(clave) || [];
    lista.push(punto);
    grupos.set(clave, lista);
  });

  return [...grupos.entries()]
    .filter(([, lista]) => lista.length > 1)
    .map(([clave, lista]) => ({
      clave,
      cantidad: lista.length,
      categorias: mergeArrayPorClave(
        lista.map((punto) => normalizarCategoriasPunto(punto)),
        (categoria) => categoria
      ),
      puntos: lista.map((punto) => ({
        _id: punto._id,
        nombre: punto.nombre,
        categoria: punto.categoria,
        categorias: normalizarCategoriasPunto(punto),
        lat: punto.lat,
        lon: punto.lon,
      })),
    }));
}

function puntajePrincipal(punto = {}) {
  return [
    punto.foto,
    punto.insignia,
    punto.descripcion_completa,
    punto.descripcion,
    punto.direccion,
    ...(punto.fotos || []),
    ...(punto.multimedia || []),
    ...(punto.historias || []),
  ].filter(Boolean).length;
}

function elegirPrincipal(grupo = []) {
  return [...grupo].sort((a, b) => {
    const score = puntajePrincipal(b) - puntajePrincipal(a);
    if (score !== 0) return score;
    return String(a._id).localeCompare(String(b._id));
  })[0];
}

async function fusionarGrupoPuntosDuplicados(puntos = []) {
  if (puntos.length < 2) return null;

  const principal = elegirPrincipal(puntos);
  const duplicados = puntos.filter(
    (punto) => punto._id.toString() !== principal._id.toString()
  );

  if (duplicados.length === 0) return null;

  const fusionado = fusionarDatosPunto(principal, duplicados);
  await collection().updateOne({ _id: principal._id }, { $set: quitarId(fusionado) });

  for (const duplicado of duplicados) {
    await reemplazarReferenciasPunto(duplicado._id, principal._id);
  }

  await collection().deleteMany({
    _id: { $in: duplicados.map((punto) => punto._id) },
  });

  return {
    principal: principal._id,
    eliminados: duplicados.map((punto) => punto._id),
    categorias: fusionado.categorias || [],
  };
}

export async function fusionarDuplicadoPublicoPorClave(clave) {
  const grupos = await listarDuplicadosPublicos();
  const grupo = grupos.find((item) => item.clave === clave);

  if (!grupo) {
    return {
      gruposFusionados: 0,
      resultado: [],
    };
  }

  const puntos = await collection()
    .find({ _id: { $in: grupo.puntos.map((punto) => punto._id) } })
    .toArray();
  const fusionado = await fusionarGrupoPuntosDuplicados(puntos);

  return {
    gruposFusionados: fusionado ? 1 : 0,
    resultado: fusionado ? [fusionado] : [],
  };
}

export async function fusionarDuplicadosPublicos() {
  const grupos = await listarDuplicadosPublicos();
  const resultado = [];

  for (const grupo of grupos) {
    const puntos = await collection()
      .find({ _id: { $in: grupo.puntos.map((punto) => punto._id) } })
      .toArray();
    const fusionado = await fusionarGrupoPuntosDuplicados(puntos);

    if (fusionado) resultado.push(fusionado);
  }

  return {
    gruposFusionados: resultado.length,
    resultado,
  };
}

export async function agregarFotoPunto(id, foto) {
  return collection().updateOne(
    { _id: new ObjectId(id) },
    { $push: { fotos: foto } }
  );
}

export async function eliminarFotoPunto(id, publicId) {
  return collection().updateOne(
    { _id: new ObjectId(id) },
    { $pull: { fotos: { publicId } } }
  );
}

export async function agregarMultimedia(id, contenido) {
  return collection().updateOne(
    { _id: new ObjectId(id) },
    { $push: { multimedia: contenido } }
  );
}

export async function eliminarMultimedia(id, multimediaId) {
  return collection().updateOne(
    { _id: new ObjectId(id) },
    { $pull: { multimedia: { _id: new ObjectId(multimediaId) } } }
  );
}
