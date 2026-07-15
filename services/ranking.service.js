import { ObjectId } from "mongodb";
import { getDB } from "./db.js";

function visitasCollection() {
  return getDB().collection("visitas");
}

function calificacionesCollection() {
  return getDB().collection("calificaciones");
}

function usuariosCollection() {
  return getDB().collection("usuarios");
}

function normalizarUsuarioRanking(item, index) {
  return {
    posicion: index + 1,
    usuarioId: item.usuarioId?.toString(),
    nombre: item.nombre || "Xendarian",
    foto: item.foto || "",
    totalInsignias: item.totalInsignias || 0,
    totalVisitados: item.totalVisitados || 0,
    ultimaVisita: item.ultimaVisita || null,
  };
}

function getParticipaRankingMatch() {
  return {
    "usuario.configuracion.mostrarActividadRanking": { $ne: false },
  };
}

export async function getRankingUsuarios({ limit = 20 } = {}) {
  const limite = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const resultados = await visitasCollection()
    .aggregate([
      {
        $group: {
          _id: "$idUsuario",
          totalVisitados: { $sum: 1 },
          ultimaVisita: { $max: "$fechaVisita" },
        },
      },
      {
        $lookup: {
          from: "usuarios",
          localField: "_id",
          foreignField: "_id",
          as: "usuario",
        },
      },
      { $unwind: "$usuario" },
      { $match: getParticipaRankingMatch() },
      {
        $project: {
          _id: 0,
          usuarioId: "$_id",
          nombre: "$usuario.nombre",
          foto: "$usuario.foto",
          totalVisitados: 1,
          totalInsignias: {
            $size: {
              $ifNull: ["$usuario.insignias", []],
            },
          },
          ultimaVisita: 1,
        },
      },
      {
        $sort: {
          totalInsignias: -1,
          totalVisitados: -1,
          ultimaVisita: -1,
          nombre: 1,
        },
      },
      { $limit: limite },
    ])
    .toArray();

  return resultados.map(normalizarUsuarioRanking);
}

export async function getMiPosicionRanking(idUsuario) {
  const usuario = await usuariosCollection().findOne({ _id: new ObjectId(idUsuario) });
  if (!usuario) return null;

  if (usuario.configuracion?.mostrarActividadRanking === false) {
    return {
      visible: false,
      message:
        "Tu posicion no se puede mostrar porque tenes desactivada la participacion en ranking.",
    };
  }

  const rankingCompleto = await getRankingUsuarios({ limit: 10000 });
  const posicion = rankingCompleto.find(
    (item) => item.usuarioId === idUsuario.toString()
  );

  if (posicion) {
    return {
      visible: true,
      ...posicion,
    };
  }

  return {
    visible: true,
    posicion: null,
    usuarioId: usuario._id.toString(),
    nombre: usuario.nombre || "Xendarian",
    foto: usuario.foto || "",
    totalInsignias: Array.isArray(usuario.insignias) ? usuario.insignias.length : 0,
    totalVisitados: Array.isArray(usuario.puntos_visitados)
      ? usuario.puntos_visitados.length
      : 0,
    message: "Todavia no tenes visitas suficientes para aparecer en el ranking.",
  };
}

export async function getRankingLugares({ limit = 20 } = {}) {
  const limite = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const resultados = await visitasCollection()
    .aggregate([
      {
        $group: {
          _id: "$idPunto",
          totalVisitas: { $sum: 1 },
          ultimaVisita: { $max: "$fechaVisita" },
        },
      },
      {
        $lookup: {
          from: "puntos_visitables",
          localField: "_id",
          foreignField: "_id",
          as: "punto",
        },
      },
      { $unwind: "$punto" },
      {
        $match: {
          "punto.creadoPor": { $exists: false },
        },
      },
      {
        $project: {
          _id: 0,
          puntoId: "$_id",
          nombre: "$punto.nombre",
          categoria: "$punto.categoria",
          foto: "$punto.foto",
          totalVisitas: 1,
          ultimaVisita: 1,
        },
      },
      {
        $sort: {
          totalVisitas: -1,
          ultimaVisita: -1,
          nombre: 1,
        },
      },
      { $limit: limite },
    ])
    .toArray();

  return resultados.map((item, index) => ({
    posicion: index + 1,
    puntoId: item.puntoId?.toString(),
    nombre: item.nombre || "Punto sin nombre",
    categoria: item.categoria || null,
    foto: item.foto || "",
    totalVisitas: item.totalVisitas || 0,
    ultimaVisita: item.ultimaVisita || null,
  }));
}

export async function getRankingLugaresMejorVotados({
  limit = 20,
  minEstrellas = 0,
} = {}) {
  const limite = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const minimo = Math.min(Math.max(Number(minEstrellas) || 0, 0), 5);

  const pipeline = [
    {
      $group: {
        _id: "$idPunto",
        promedioEstrellas: { $avg: "$estrellas" },
        totalCalificaciones: { $sum: 1 },
        ultimaCalificacion: { $max: "$updatedAt" },
      },
    },
  ];

  if (minimo > 0) {
    pipeline.push({ $match: { promedioEstrellas: { $gte: minimo } } });
  }

  pipeline.push(
    {
      $lookup: {
        from: "puntos_visitables",
        localField: "_id",
        foreignField: "_id",
        as: "punto",
      },
    },
    { $unwind: "$punto" },
    {
      $match: {
        "punto.creadoPor": { $exists: false },
      },
    },
    {
      $lookup: {
        from: "visitas",
        localField: "_id",
        foreignField: "idPunto",
        as: "visitas",
      },
    },
    {
      $project: {
        _id: 0,
        puntoId: "$_id",
        nombre: "$punto.nombre",
        categoria: "$punto.categoria",
        foto: "$punto.foto",
        promedioEstrellas: 1,
        totalCalificaciones: 1,
        totalVisitas: { $size: "$visitas" },
        ultimaCalificacion: 1,
      },
    },
    {
      $sort: {
        promedioEstrellas: -1,
        totalCalificaciones: -1,
        totalVisitas: -1,
        ultimaCalificacion: -1,
        nombre: 1,
      },
    },
    { $limit: limite }
  );

  const resultados = await calificacionesCollection().aggregate(pipeline).toArray();

  return resultados.map((item, index) => ({
    posicion: index + 1,
    puntoId: item.puntoId?.toString(),
    nombre: item.nombre || "Punto sin nombre",
    categoria: item.categoria || null,
    foto: item.foto || "",
    promedioEstrellas: Number((item.promedioEstrellas || 0).toFixed(1)),
    totalCalificaciones: item.totalCalificaciones || 0,
    totalVisitas: item.totalVisitas || 0,
    ultimaCalificacion: item.ultimaCalificacion || null,
  }));
}
