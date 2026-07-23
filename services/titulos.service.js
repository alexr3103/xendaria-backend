import { ObjectId } from "mongodb";
import { getDB } from "./db.js";
import * as servicePuntos from "./puntos_visitables.service.js";

const CATEGORIAS_SIN_TITULO = new Set(["propios"]);
const CATEGORIAS_TITULOS_DEFAULT = new Set([
  "sin_visitas",
  "con_visitas_sin_titulo",
]);

const TITULOS_DEFAULT = [
  {
    categoria: "sin_visitas",
    titulo: "Explorador de la nada misma",
    descripcion: "Titulo inicial mientras todavia no registra visitas.",
    umbral: 0,
    orden: 0,
    esDefault: true,
  },
  {
    categoria: "con_visitas_sin_titulo",
    titulo: "Explorador petite",
    descripcion: "Titulo base cuando ya tiene visitas pero aun no desbloqueo otro titulo.",
    umbral: 0,
    orden: 1,
    esDefault: true,
  },
  {
    categoria: "puntos_populares",
    titulo: "Cazadora de iconos",
    descripcion: "Por visitar lugares populares de la ciudad.",
    umbral: 10,
    orden: 10,
  },
  {
    categoria: "paradas_de_bus_turistico",
    titulo: "Guia de recorridos",
    descripcion: "Por visitar puntos conectados al circuito turistico.",
    umbral: 10,
    orden: 20,
  },
  {
    categoria: "paseo_de_la_historieta",
    titulo: "Guardiana de vinetas",
    descripcion: "Por visitar lugares vinculados a la historieta.",
    umbral: 10,
    orden: 30,
  },
  {
    categoria: "espacios_verdes_publicos",
    titulo: "Guardian de parques",
    descripcion: "Por visitar parques y espacios verdes publicos.",
    umbral: 10,
    orden: 40,
  },
  {
    categoria: "espacios_verdes_privados",
    titulo: "Rey de las flores",
    descripcion: "Por visitar jardines y rincones verdes especiales.",
    umbral: 10,
    orden: 50,
  },
  {
    categoria: "lugares_de_esparcimiento",
    titulo: "Maestra del paseo",
    descripcion: "Por visitar lugares de recreacion y esparcimiento.",
    umbral: 10,
    orden: 60,
  },
  {
    categoria: "curiosos",
    titulo: "Detective de rarezas",
    descripcion: "Por encontrar puntos curiosos de la ciudad.",
    umbral: 10,
    orden: 70,
  },
];

function collection() {
  return getDB().collection("titulos_usuario");
}

function visitasCollection() {
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

function normalizarCategoriasPunto(punto = {}) {
  const categorias = [
    ...(Array.isArray(punto.categorias) ? punto.categorias : []),
    punto.categoria,
  ];

  return [...new Set(
    categorias
      .map((categoria) => String(categoria || "").trim())
      .filter((categoria) => categoria && !CATEGORIAS_SIN_TITULO.has(categoria))
  )];
}

function normalizarTituloInput(data = {}, actual = {}) {
  const categoria = String(data.categoria ?? actual.categoria ?? "").trim();
  const titulo = String(data.titulo ?? actual.titulo ?? "").trim();
  const descripcion = String(data.descripcion ?? actual.descripcion ?? "").trim();
  const umbral = Number(data.umbral ?? actual.umbral ?? 10);
  const orden = Number(data.orden ?? actual.orden ?? umbral);
  const activo =
    data.activo !== undefined ? Boolean(data.activo) : actual.activo !== false;

  if (!categoria) {
    const error = new Error("La categoria es obligatoria");
    error.status = 400;
    throw error;
  }

  if (!titulo) {
    const error = new Error("El titulo es obligatorio");
    error.status = 400;
    throw error;
  }

  const permiteUmbralCero = CATEGORIAS_TITULOS_DEFAULT.has(categoria);
  if (
    !Number.isFinite(umbral) ||
    umbral < 0 ||
    (!permiteUmbralCero && umbral < 1)
  ) {
    const error = new Error("El umbral no es valido para este titulo");
    error.status = 400;
    throw error;
  }

  return {
    categoria,
    titulo,
    descripcion,
    umbral: Math.floor(umbral),
    orden: Number.isFinite(orden) ? Math.floor(orden) : Math.floor(umbral),
    activo,
    esDefault: CATEGORIAS_TITULOS_DEFAULT.has(categoria),
    updatedAt: new Date(),
  };
}

function serializarTitulo(titulo = {}) {
  return {
    ...titulo,
    _id: titulo._id?.toString?.() || titulo._id,
  };
}

async function getPuntosVisitados(idUsuario) {
  const visitas = await visitasCollection()
    .find({ idUsuario: new ObjectId(idUsuario) })
    .sort({ fechaVisita: -1 })
    .toArray();

  let ids = visitas.map((visita) => normalizarId(visita.idPunto)).filter(Boolean);

  if (ids.length === 0) {
    const usuario = await usuariosCollection().findOne(
      { _id: new ObjectId(idUsuario) },
      { projection: { puntos_visitados: 1 } }
    );

    ids = (usuario?.puntos_visitados || [])
      .map((visita) => normalizarId(visita?.idPunto || visita))
      .filter(Boolean);
  }

  const idsUnicos = [...new Set(ids)].filter((id) => ObjectId.isValid(id));
  if (idsUnicos.length === 0) return [];

  return servicePuntos.getPuntosByIds(idsUnicos.map((id) => new ObjectId(id)));
}

export async function asegurarIndicesTitulos() {
  await collection().createIndex(
    { categoria: 1, umbral: 1 },
    { unique: true, name: "titulo_categoria_umbral" }
  );

  await collection().createIndex(
    { activo: 1, orden: 1 },
    { name: "titulo_activo_orden" }
  );

  const ahora = new Date();
  const operaciones = TITULOS_DEFAULT.map((titulo) => ({
    updateOne: {
      filter: { categoria: titulo.categoria, umbral: titulo.umbral },
      update: {
        $setOnInsert: {
          ...titulo,
          activo: true,
          createdAt: ahora,
          updatedAt: ahora,
        },
      },
      upsert: true,
    },
  }));

  if (operaciones.length > 0) {
    await collection().bulkWrite(operaciones, { ordered: false });
  }
}

export async function getTitulos({ incluirInactivos = false } = {}) {
  const filtro = incluirInactivos ? {} : { activo: { $ne: false } };

  const titulos = await collection()
    .find(filtro)
    .sort({ orden: 1, categoria: 1, umbral: 1 })
    .toArray();

  return titulos.map(serializarTitulo);
}

export async function crearTitulo(data) {
  const titulo = {
    ...normalizarTituloInput(data),
    createdAt: new Date(),
  };

  const resultado = await collection().insertOne(titulo);
  return serializarTitulo({ ...titulo, _id: resultado.insertedId });
}

export async function editarTitulo(idTitulo, data) {
  const actual = await collection().findOne({ _id: new ObjectId(idTitulo) });
  if (!actual) return null;

  const titulo = normalizarTituloInput(data, actual);
  await collection().updateOne(
    { _id: new ObjectId(idTitulo) },
    { $set: titulo }
  );

  return serializarTitulo({
    ...actual,
    ...titulo,
    _id: actual._id,
  });
}

export async function eliminarTitulo(idTitulo) {
  return collection().deleteOne({ _id: new ObjectId(idTitulo) });
}

export async function getTitulosUsuario(idUsuario) {
  const [reglas, puntos] = await Promise.all([
    getTitulos(),
    getPuntosVisitados(idUsuario),
  ]);

  const tituloSinVisitas = reglas.find(
    (regla) => regla.categoria === "sin_visitas"
  );
  const tituloConVisitas = reglas.find(
    (regla) => regla.categoria === "con_visitas_sin_titulo"
  );
  const reglasPorCategoria = reglas.filter(
    (regla) => !CATEGORIAS_TITULOS_DEFAULT.has(regla.categoria)
  );

  const conteoPorCategoria = new Map();

  puntos.forEach((punto) => {
    normalizarCategoriasPunto(punto).forEach((categoria) => {
      conteoPorCategoria.set(
        categoria,
        (conteoPorCategoria.get(categoria) || 0) + 1
      );
    });
  });

  const titulos = reglasPorCategoria.map((regla) => {
    const progreso = conteoPorCategoria.get(regla.categoria) || 0;
    const porcentaje = Math.min(100, Math.round((progreso / regla.umbral) * 100));

    return {
      ...regla,
      progreso,
      porcentaje,
      desbloqueado: progreso >= regla.umbral,
    };
  });

  const desbloqueados = titulos
    .filter((titulo) => titulo.desbloqueado)
    .sort((a, b) => {
      if (b.umbral !== a.umbral) return b.umbral - a.umbral;
      if (b.progreso !== a.progreso) return b.progreso - a.progreso;
      return a.orden - b.orden;
    });

  const conteoCategorias = [...conteoPorCategoria.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  const tituloDefault =
    puntos.length === 0 ? tituloSinVisitas : tituloConVisitas;
  const tituloActual = desbloqueados[0] || (
    tituloDefault
      ? {
          ...tituloDefault,
          progreso: puntos.length,
          porcentaje: 0,
          desbloqueado: true,
          esDefault: true,
        }
      : null
  );

  return {
    usuarioId: idUsuario,
    tituloActual: tituloActual ? serializarTitulo(tituloActual) : null,
    desbloqueados,
    titulos,
    conteoCategorias,
  };
}
