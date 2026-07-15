import { getDB } from "./db.js";
import * as rankingService from "./ranking.service.js";

const ESTADOS_ORDEN_VISIBLES = ["pagada", "procesando", "enviada"];

function db() {
  return getDB();
}

function puntosCollection() {
  return db().collection("puntos_visitables");
}

function rutasCollection() {
  return db().collection("rutas_recomendadas");
}

function rutasRealizadasCollection() {
  return db().collection("rutas_realizadas");
}

function rutasProgresoCollection() {
  return db().collection("rutas_progreso");
}

function ordenesCollection() {
  return db().collection("ordenes");
}

function productosCollection() {
  return db().collection("productos_merch");
}

function calificacionesCollection() {
  return db().collection("calificaciones");
}

function visitasCollection() {
  return db().collection("visitas");
}

function normalizarNumero(valor = 0) {
  return Number(valor || 0);
}

function alerta(tipo, titulo, total, descripcion, to, variant = "info") {
  return {
    tipo,
    titulo,
    total: normalizarNumero(total),
    descripcion,
    to,
    variant,
  };
}

async function getMetricasPuntos() {
  const [metricas = {}] = await puntosCollection()
    .aggregate([
      { $match: { creadoPor: { $exists: false } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          activos: {
            $sum: { $cond: [{ $ne: ["$activo", false] }, 1, 0] },
          },
          inactivos: {
            $sum: { $cond: [{ $eq: ["$activo", false] }, 1, 0] },
          },
          sinFoto: {
            $sum: {
              $cond: [{ $eq: [{ $ifNull: ["$foto", ""] }, ""] }, 1, 0],
            },
          },
          sinInsignia: {
            $sum: {
              $cond: [
                {
                  $or: [
                    {
                      $and: [
                        { $eq: [{ $type: "$insignia" }, "string"] },
                        { $ne: ["$insignia", ""] },
                      ],
                    },
                    { $ne: [{ $ifNull: ["$insignia.url", ""] }, ""] },
                  ],
                },
                0,
                1,
              ],
            },
          },
        },
      },
    ])
    .toArray();

  return {
    total: normalizarNumero(metricas.total),
    activos: normalizarNumero(metricas.activos),
    inactivos: normalizarNumero(metricas.inactivos),
    sinFoto: normalizarNumero(metricas.sinFoto),
    sinInsignia: normalizarNumero(metricas.sinInsignia),
  };
}

async function getMetricasRutas() {
  const [metricas = {}] = await rutasCollection()
    .aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          activas: {
            $sum: { $cond: [{ $ne: ["$activa", false] }, 1, 0] },
          },
          inactivas: {
            $sum: { $cond: [{ $eq: ["$activa", false] }, 1, 0] },
          },
          destacadas: {
            $sum: { $cond: [{ $eq: ["$destacada", true] }, 1, 0] },
          },
        },
      },
    ])
    .toArray();

  const pausadas = await rutasProgresoCollection().countDocuments({
    estado: "pausada",
  });

  return {
    total: normalizarNumero(metricas.total),
    activas: normalizarNumero(metricas.activas),
    inactivas: normalizarNumero(metricas.inactivas),
    destacadas: normalizarNumero(metricas.destacadas),
    pausadas,
  };
}

async function getMetricasProductos() {
  const [metricas = {}] = await productosCollection()
    .aggregate([
      {
        $project: {
          activo: { $ne: ["$activo", false] },
          stockCalculado: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$variantes", []] } }, 0] },
              { $sum: "$variantes.stock" },
              { $ifNull: ["$stock", 0] },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          activos: { $sum: { $cond: ["$activo", 1, 0] } },
          inactivos: { $sum: { $cond: ["$activo", 0, 1] } },
          sinStock: {
            $sum: { $cond: [{ $lte: ["$stockCalculado", 0] }, 1, 0] },
          },
          bajoStock: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$stockCalculado", 0] },
                    { $lte: ["$stockCalculado", 3] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray();

  return {
    total: normalizarNumero(metricas.total),
    activos: normalizarNumero(metricas.activos),
    inactivos: normalizarNumero(metricas.inactivos),
    sinStock: normalizarNumero(metricas.sinStock),
    bajoStock: normalizarNumero(metricas.bajoStock),
  };
}

async function getMetricasOrdenes() {
  const estados = Object.fromEntries(
    ESTADOS_ORDEN_VISIBLES.map((estado) => [estado, 0])
  );

  const resultados = await ordenesCollection()
    .aggregate([
      { $match: { estado: { $in: ESTADOS_ORDEN_VISIBLES } } },
      {
        $group: {
          _id: "$estado",
          total: { $sum: 1 },
          ingresos: { $sum: { $ifNull: ["$total", 0] } },
        },
      },
    ])
    .toArray();

  let ingresos = 0;
  resultados.forEach((item) => {
    estados[item._id] = normalizarNumero(item.total);
    ingresos += normalizarNumero(item.ingresos);
  });

  return {
    total: Object.values(estados).reduce((acc, valor) => acc + valor, 0),
    ingresos,
    porEstado: estados,
  };
}

async function getMetricasCalificaciones() {
  const [metricas = {}] = await calificacionesCollection()
    .aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          promedio: { $avg: "$estrellas" },
        },
      },
    ])
    .toArray();

  return {
    total: normalizarNumero(metricas.total),
    promedio: Number((metricas.promedio || 0).toFixed(1)),
  };
}

async function getTopRutasRealizadas(limit = 5) {
  return rutasRealizadasCollection()
    .aggregate([
      {
        $group: {
          _id: "$idRuta",
          totalRealizaciones: { $sum: { $ifNull: ["$veces", 1] } },
          ultimaRealizacion: { $max: "$fechaUltimaCompletada" },
        },
      },
      {
        $lookup: {
          from: "rutas_recomendadas",
          localField: "_id",
          foreignField: "_id",
          as: "ruta",
        },
      },
      { $unwind: "$ruta" },
      {
        $project: {
          _id: 0,
          rutaId: "$_id",
          nombre: "$ruta.nombre",
          categoria: "$ruta.categoria",
          activa: { $ne: ["$ruta.activa", false] },
          cantidadPuntos: "$ruta.cantidadPuntos",
          totalRealizaciones: 1,
          ultimaRealizacion: 1,
        },
      },
      { $sort: { totalRealizaciones: -1, ultimaRealizacion: -1, nombre: 1 } },
      { $limit: limit },
    ])
    .toArray();
}

async function getCategoriasMasVisitadas(limit = 6) {
  return visitasCollection()
    .aggregate([
      {
        $group: {
          _id: "$idPunto",
          totalVisitas: { $sum: 1 },
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
          totalVisitas: 1,
          idPunto: "$_id",
          categorias: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$punto.categorias", []] } }, 0] },
              "$punto.categorias",
              ["$punto.categoria"],
            ],
          },
        },
      },
      { $unwind: "$categorias" },
      { $match: { categorias: { $ne: null } } },
      {
        $group: {
          _id: "$categorias",
          totalVisitas: { $sum: "$totalVisitas" },
          puntos: { $addToSet: "$idPunto" },
        },
      },
      {
        $project: {
          _id: 0,
          categoria: "$_id",
          totalVisitas: 1,
          totalPuntos: { $size: "$puntos" },
        },
      },
      { $sort: { totalVisitas: -1, totalPuntos: -1, categoria: 1 } },
      { $limit: limit },
    ])
    .toArray();
}

async function getRutasConPuntosInactivos() {
  const [resultado = {}] = await rutasCollection()
    .aggregate([
      { $match: { activa: { $ne: false } } },
      {
        $lookup: {
          from: "puntos_visitables",
          localField: "puntos",
          foreignField: "_id",
          as: "puntosInfo",
        },
      },
      {
        $match: {
          "puntosInfo.activo": false,
        },
      },
      { $count: "total" },
    ])
    .toArray();

  return normalizarNumero(resultado.total);
}

async function getActividadReciente() {
  const desde = new Date();
  desde.setDate(desde.getDate() - 7);

  const [visitas, ordenes, calificaciones, rutasRealizadas] = await Promise.all([
    visitasCollection().countDocuments({ fechaVisita: { $gte: desde } }),
    ordenesCollection().countDocuments({
      estado: { $in: ESTADOS_ORDEN_VISIBLES },
      createdAt: { $gte: desde },
    }),
    calificacionesCollection().countDocuments({ updatedAt: { $gte: desde } }),
    rutasRealizadasCollection().countDocuments({
      fechaUltimaCompletada: { $gte: desde },
    }),
  ]);

  return {
    desde,
    visitas,
    ordenes,
    calificaciones,
    rutasRealizadas,
  };
}

function construirAlertas({
  puntos,
  rutas,
  productos,
  ordenes,
  rutasConPuntosInactivos,
}) {
  return [
    puntos.sinFoto > 0 &&
      alerta(
        "puntos_sin_foto",
        "Puntos sin foto principal",
        puntos.sinFoto,
        "Conviene completarlos para que el detalle del usuario no quede vacio.",
        "/admin/puntos",
        "warning"
      ),
    puntos.sinInsignia > 0 &&
      alerta(
        "puntos_sin_insignia",
        "Puntos sin insignia",
        puntos.sinInsignia,
        "Son lugares que todavia no entregan recompensa visual.",
        "/admin/puntos",
        "info"
      ),
    rutasConPuntosInactivos > 0 &&
      alerta(
        "rutas_con_puntos_inactivos",
        "Rutas con puntos inactivos",
        rutasConPuntosInactivos,
        "Revisalas para evitar recorridos con puntos apagados.",
        "/admin/rutas",
        "danger"
      ),
    productos.sinStock > 0 &&
      alerta(
        "productos_sin_stock",
        "Productos sin stock",
        productos.sinStock,
        "No deberian quedar visibles si no pueden comprarse.",
        "/admin/merch",
        "danger"
      ),
    ordenes.porEstado.pagada + ordenes.porEstado.procesando > 0 &&
      alerta(
        "ordenes_pendientes",
        "Ordenes por preparar o enviar",
        ordenes.porEstado.pagada + ordenes.porEstado.procesando,
        "Hay compras pagadas que todavia requieren gestion.",
        "/admin/merch",
        "warning"
      ),
    rutas.pausadas > 0 &&
      alerta(
        "rutas_pausadas",
        "Rutas pausadas por usuarios",
        rutas.pausadas,
        "Indica recorridos iniciados que todavia no se completaron.",
        "/admin/rutas",
        "info"
      ),
  ].filter(Boolean);
}

export async function getDashboardAdmin() {
  const [
    totalUsuarios,
    puntos,
    rutas,
    productos,
    ordenes,
    calificaciones,
    totalVisitas,
    topPuntosVisitados,
    topRutasRealizadas,
    topPuntosCalificados,
    categoriasMasVisitadas,
    rutasConPuntosInactivos,
    actividadReciente,
  ] = await Promise.all([
    db().collection("usuarios").countDocuments(),
    getMetricasPuntos(),
    getMetricasRutas(),
    getMetricasProductos(),
    getMetricasOrdenes(),
    getMetricasCalificaciones(),
    visitasCollection().countDocuments(),
    rankingService.getRankingLugares({ limit: 5 }),
    getTopRutasRealizadas(5),
    rankingService.getRankingLugaresMejorVotados({ limit: 5 }),
    getCategoriasMasVisitadas(6),
    getRutasConPuntosInactivos(),
    getActividadReciente(),
  ]);

  return {
    updatedAt: new Date(),
    resumen: {
      usuarios: totalUsuarios,
      puntos,
      rutas,
      productos,
      ordenes,
      visitas: {
        total: totalVisitas,
      },
      calificaciones,
    },
    actividadReciente,
    topPuntosVisitados,
    topRutasRealizadas,
    topPuntosCalificados,
    categoriasMasVisitadas,
    alertas: construirAlertas({
      puntos,
      rutas,
      productos,
      ordenes,
      rutasConPuntosInactivos,
    }),
  };
}
