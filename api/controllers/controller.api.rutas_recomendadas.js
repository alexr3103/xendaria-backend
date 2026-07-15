import * as serviceRutas from "../../services/rutas_recomendadas.service.js";

function responderError(res, error, fallback) {
  return res.status(error.status || 500).json({
    message: error.message || fallback,
    puntosFaltantes: error.puntosFaltantes,
    puntosInvalidos: error.puntosInvalidos,
  });
}

export function getCategoriasRutas(_req, res) {
  return res.status(200).json({
    categorias: serviceRutas.CATEGORIAS_RUTAS,
  });
}

export async function getRutas(req, res) {
  try {
    const rutas = await serviceRutas.getRutas(req.query);
    return res.status(200).json(rutas);
  } catch (error) {
    console.error("[getRutas]", error);
    return responderError(res, error, "Error al obtener rutas recomendadas");
  }
}

export async function getRutasConEstadoUsuario(req, res) {
  try {
    const rutas = await serviceRutas.getRutasConEstadoUsuario(req.user.id, req.query);
    return res.status(200).json(rutas);
  } catch (error) {
    console.error("[getRutasConEstadoUsuario]", error);
    return responderError(res, error, "Error al obtener rutas recomendadas");
  }
}

export async function getRutasAdmin(req, res) {
  try {
    const rutas = await serviceRutas.getRutas(req.query, {
      incluirInactivas: true,
    });
    return res.status(200).json(rutas);
  } catch (error) {
    console.error("[getRutasAdmin]", error);
    return responderError(res, error, "Error al obtener rutas recomendadas");
  }
}

export async function getRutaById(req, res) {
  try {
    const ruta = await serviceRutas.getRutaById(req.params.idRuta);

    if (!ruta) {
      return res.status(404).json({ message: "Ruta no encontrada" });
    }

    return res.status(200).json(ruta);
  } catch (error) {
    console.error("[getRutaById]", error);
    return responderError(res, error, "Error al obtener la ruta");
  }
}

export async function crearRuta(req, res) {
  try {
    const ruta = await serviceRutas.crearRuta(req.body, req.user.id);

    return res.status(201).json(ruta);
  } catch (error) {
    console.error("[crearRuta]", error);
    return responderError(res, error, "No se pudo crear la ruta");
  }
}

export async function editarRuta(req, res) {
  try {
    const ruta = await serviceRutas.editarRuta(req.params.idRuta, req.body);

    return res.status(200).json(ruta);
  } catch (error) {
    console.error("[editarRuta]", error);
    return responderError(res, error, "No se pudo editar la ruta");
  }
}

export async function eliminarRuta(req, res) {
  try {
    const resultado = await serviceRutas.eliminarRuta(req.params.idRuta);

    if (!resultado.deletedCount) {
      return res.status(404).json({ message: "Ruta no encontrada" });
    }

    return res.status(200).json({ message: "Ruta eliminada correctamente" });
  } catch (error) {
    console.error("[eliminarRuta]", error);
    return responderError(res, error, "No se pudo eliminar la ruta");
  }
}

export async function registrarRutaRealizada(req, res) {
  try {
    const realizacion = await serviceRutas.registrarRutaRealizada({
      idUsuario: req.user.id,
      idRuta: req.params.idRuta,
      modo: req.body.modo,
      puntosCompletados: req.body.puntosCompletados,
    });

    return res.status(200).json({
      message: "Ruta registrada como realizada",
      realizacion,
    });
  } catch (error) {
    console.error("[registrarRutaRealizada]", error);
    return responderError(res, error, "No se pudo registrar la ruta realizada");
  }
}

export async function guardarProgresoRuta(req, res) {
  try {
    const progreso = await serviceRutas.guardarProgresoRuta({
      idUsuario: req.user.id,
      idRuta: req.params.idRuta,
      modo: req.body.modo,
      puntosCompletados: req.body.puntosCompletados,
      estado: req.body.estado,
    });

    return res.status(200).json({
      message: "Progreso de ruta guardado",
      progreso,
    });
  } catch (error) {
    console.error("[guardarProgresoRuta]", error);
    return responderError(res, error, "No se pudo guardar el progreso de la ruta");
  }
}

export async function getProgresoRutaUsuario(req, res) {
  try {
    const progreso = await serviceRutas.getProgresoRutaUsuario(
      req.user.id,
      req.params.idRuta,
      req.query.modo
    );

    return res.status(200).json({ progreso });
  } catch (error) {
    console.error("[getProgresoRutaUsuario]", error);
    return responderError(res, error, "No se pudo obtener el progreso de la ruta");
  }
}

export async function descartarProgresoRuta(req, res) {
  try {
    const resultado = await serviceRutas.descartarProgresoRuta(
      req.user.id,
      req.params.idRuta,
      req.query.modo || req.body?.modo
    );

    return res.status(200).json({
      message: "Progreso de ruta descartado",
      eliminados: resultado.deletedCount || 0,
    });
  } catch (error) {
    console.error("[descartarProgresoRuta]", error);
    return responderError(res, error, "No se pudo descartar el progreso de la ruta");
  }
}

export async function getEstadoRutaUsuario(req, res) {
  try {
    const estado = await serviceRutas.getEstadoRutaUsuario(
      req.user.id,
      req.params.idRuta
    );

    return res.status(200).json(estado);
  } catch (error) {
    console.error("[getEstadoRutaUsuario]", error);
    return responderError(res, error, "No se pudo obtener el estado de la ruta");
  }
}

export async function getMisRutasRealizadas(req, res) {
  try {
    const rutas = await serviceRutas.getRutasRealizadasUsuario(req.user.id);
    return res.status(200).json(rutas);
  } catch (error) {
    console.error("[getMisRutasRealizadas]", error);
    return responderError(res, error, "No se pudo obtener tus rutas realizadas");
  }
}
