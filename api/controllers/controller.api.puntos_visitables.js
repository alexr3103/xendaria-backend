import * as service from "../../services/puntos_visitables.service.js";
import { consultarStreetViewMetadata } from "../../services/streetview.service.js";
import { ObjectId } from "mongodb";

const TIPOS_MULTIMEDIA = new Set(["youtube", "spotify", "imagen", "enlace"]);

function esAdmin(req) {
  return req.user?.role === "admin";
}

function normalizarHistorias(historias) {
  if (!Array.isArray(historias)) return [];

  return historias.slice(0, 3).map((historia) => ({
    titulo: String(historia.titulo || "").trim(),
    contenido: String(historia.contenido || "").trim(),
    foto: historia.foto || null,
  }));
}

function validarUrlMultimedia(tipo, value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (!["https:", "http:"].includes(url.protocol)) return false;

  const host = url.hostname.replace(/^www\./, "");
  if (tipo === "youtube") {
    return host === "youtube.com" || host === "youtu.be";
  }
  if (tipo === "spotify") {
    return host === "open.spotify.com";
  }

  return true;
}

function normalizarCoordenadas(lat, lon) {
  const latNumber = Number(lat);
  const lonNumber = Number(lon);

  if (!Number.isFinite(latNumber) || !Number.isFinite(lonNumber)) {
    return null;
  }

  return {
    lat: latNumber,
    lon: lonNumber,
    ubicacion: {
      type: "Point",
      coordinates: [lonNumber, latNumber],
    },
  };
}

function normalizarCategoriasBody(body = {}) {
  const valores = [
    ...(Array.isArray(body.categorias) ? body.categorias : []),
    body.categoria,
  ];
  const categoriasUnicas = new Set();

  valores.forEach((valor) => {
    const categoria = String(valor || "").trim();
    if (categoria) categoriasUnicas.add(categoria);
  });

  return [...categoriasUnicas];
}

function crearPuntoDesdeBody(body) {
  const coordenadas = normalizarCoordenadas(body.lat, body.lon);
  const categorias = normalizarCategoriasBody(body);

  return {
    categoria: body.categoria || categorias[0] || "",
    categorias,
    nombre: body.nombre || "",
    lat: coordenadas?.lat ?? null,
    lon: coordenadas?.lon ?? null,
    ubicacion: coordenadas?.ubicacion ?? null,
    multimedia: Array.isArray(body.multimedia) ? body.multimedia : [],
    historias: normalizarHistorias(body.historias),
    vista360: body.vista360 || {
      habilitada: false,
      disponible: false,
      estado: null,
      panoId: null,
      mensaje: "Vista 360 todavia no verificada",
      ultimaVerificacion: null,
    },
    foto: body.foto || "",
    fotos: Array.isArray(body.fotos) ? body.fotos : [],
    descripcion: body.descripcion || "",
    descripcion_completa: body.descripcion_completa || "",
    direccion: body.direccion || "",
    insignia: body.insignia || null,
    activo: body.activo !== false,
  };
}

// Obtener todos los puntos
export async function getPuntos(req, res) {
  try {
    const puntos = await service.getPuntos({
      ...req.query,
      incluirInactivos: esAdmin(req) && req.query.incluirInactivos === "true",
      estado: esAdmin(req) ? req.query.estado : undefined,
    });
    return res.status(200).json(puntos);
  } catch (e) {
    console.error("[getPuntos]", e);
    return res.status(500).json({ message: "Error al obtener los puntos" });
  }
}

// Obtener punto por ID
export async function getPuntosById(req, res) {
  try {
    const id = req.params.id;
    const punto = await service.getPuntosById(id, {
      incluirInactivos: esAdmin(req),
    });
    if (!punto) {
      return res.status(404).json({ message: "No se encontró el punto" });
    }
    if (punto.creadoPor || punto.visibilidad === "privado") {
      return res.status(404).json({ message: "No se encontro el punto" });
    }
    return res.status(200).json(punto);
  } catch (e) {
    console.error("[getPuntosById]", e);
    return res.status(500).json({ message: "Error al obtener el punto" });
  }
}

export async function listarDuplicados(req, res) {
  try {
    const duplicados = await service.listarDuplicadosPublicos();
    return res.status(200).json(duplicados);
  } catch (e) {
    console.error("[listarDuplicados]", e);
    return res.status(500).json({ message: "No se pudieron listar los duplicados" });
  }
}

export async function fusionarDuplicados(req, res) {
  try {
    const resultado = await service.fusionarDuplicadosPublicos();
    return res.status(200).json(resultado);
  } catch (e) {
    console.error("[fusionarDuplicados]", e);
    return res.status(500).json({ message: "No se pudieron fusionar los duplicados" });
  }
}

export async function fusionarDuplicado(req, res) {
  try {
    const clave = String(req.body?.clave || "").trim();

    if (!clave) {
      return res.status(400).json({ message: "Falta la clave del grupo duplicado" });
    }

    const resultado = await service.fusionarDuplicadoPublicoPorClave(clave);
    return res.status(200).json(resultado);
  } catch (e) {
    console.error("[fusionarDuplicado]", e);
    return res.status(500).json({ message: "No se pudo fusionar el duplicado" });
  }
}

// Crear nuevo punto
export async function nuevoPunto(req, res) {
  try {
    const punto = crearPuntoDesdeBody(req.body);
    const duplicado = await service.buscarPuntoDuplicado(punto);

    if (duplicado) {
      const fusionado = await service.fusionarPuntoEnPrincipal(duplicado._id, punto);
      return res.status(200).json({
        message: "El punto ya existia y se fusiono con sus categorias",
        fusionado: true,
        punto: fusionado,
      });
    }

    const puntoNuevo = await service.guardarPunto(punto);
    return res.status(201).json(puntoNuevo);
  } catch (e) {
    console.error("[nuevoPunto]", e);
    return res.status(500).json({ message: "No se pudo guardar el punto" });
  }
}

// Eliminar punto
export async function eliminarPunto(req, res) {
  try {
    const id = req.params.id;
    await service.eliminarPunto(id);
    return res.status(202).json({ message: `El punto fue eliminado correctamente (id: ${id})` });
  } catch (e) {
    console.error("[eliminarPunto]", e);
    return res.status(500).json({ message: "No se pudo eliminar el punto" });
  }
}

// Editar parcialmente (PATCH)
export async function editarPunto(req, res) {
  try {
    const id = req.params.id;
    const data = { ...req.body };
    let puntoActual = null;

    if (data.historias !== undefined) {
      if (!Array.isArray(data.historias) || data.historias.length > 3) {
        return res.status(400).json({
          message: "Un punto puede tener hasta 3 historias",
        });
      }

      const historias = normalizarHistorias(data.historias);
      if (historias.some((historia) => !historia.titulo || !historia.contenido)) {
        return res.status(400).json({
          message: "Cada historia necesita titulo y contenido",
        });
      }
      data.historias = historias;
    }

    if (data.categoria !== undefined || data.categorias !== undefined) {
      const categorias = normalizarCategoriasBody(data);
      data.categorias = categorias;
      data.categoria = data.categoria || categorias[0] || "";
    }

    if (data.nombre !== undefined && data.lat === undefined && data.lon === undefined) {
      puntoActual = await service.getPuntosById(id, { incluirInactivos: true });
      if (!puntoActual) {
        return res.status(404).json({ message: "No se encontro el punto" });
      }
    }

    if (data.lat !== undefined || data.lon !== undefined) {
      puntoActual = await service.getPuntosById(id, { incluirInactivos: true });
      if (!puntoActual) {
        return res.status(404).json({ message: "No se encontro el punto" });
      }

      const lat = data.lat !== undefined ? data.lat : puntoActual.lat;
      const lon = data.lon !== undefined ? data.lon : puntoActual.lon;
      const coordenadas = normalizarCoordenadas(lat, lon);

      if (!coordenadas) {
        return res.status(400).json({ message: "Coordenadas invalidas" });
      }

      data.lat = coordenadas.lat;
      data.lon = coordenadas.lon;
      data.ubicacion = coordenadas.ubicacion;
    }

    if (puntoActual) {
      const duplicado = await service.buscarPuntoDuplicado(
        { ...puntoActual, ...data },
        { excluirId: id }
      );

      if (duplicado) {
        return res.status(409).json({
          message: "Ya existe otro punto con ese nombre y esa ubicacion",
          puntoId: duplicado._id,
        });
      }
    }

    const puntoEditado = await service.editarPunto(id, data);
    return res.status(202).json(puntoEditado);
  } catch (e) {
    console.error("[editarPunto]", e);
    return res.status(500).json({ message: "No se pudo editar el punto" });
  }
}

// Reemplazar completamente (PUT)
export async function reemplazarPunto(req, res) {
  try {
    const id = req.params.id;
    const punto = crearPuntoDesdeBody(req.body);
    const duplicado = await service.buscarPuntoDuplicado(punto, { excluirId: id });

    if (duplicado) {
      return res.status(409).json({
        message: "Ya existe otro punto con ese nombre y esa ubicacion",
        puntoId: duplicado._id,
      });
    }

    const puntoEditado = await service.reemplazarPunto(id, punto);
    return res.status(202).json(puntoEditado);
  } catch (e) {
    console.error("[reemplazarPunto]", e);
    return res.status(500).json({ message: "No se pudo reemplazar el punto" });
  }
}

// Verificar si Google Street View tiene un panorama cercano al punto
export async function verificarVista360(req, res) {
  try {
    const id = req.params.id;
    const radio = Math.min(Math.max(Number(req.body.radio) || 50, 1), 500);
    const punto = await service.getPuntosById(id, { incluirInactivos: true });

    if (!punto) {
      return res.status(404).json({ message: "No se encontro el punto" });
    }

    const metadata = await consultarStreetViewMetadata({
      lat: punto.lat,
      lon: punto.lon,
      radio,
    });

    const vista360 = {
      habilitada: metadata.disponible,
      disponible: metadata.disponible,
      estado: metadata.estado,
      panoId: metadata.panoId,
      fechaImagen: metadata.fechaImagen,
      copyright: metadata.copyright,
      mensaje: metadata.mensaje,
      ultimaVerificacion: new Date(),
    };

    await service.editarPunto(id, { vista360 });

    return res.status(200).json({ vista360 });
  } catch (error) {
    console.error("[verificarVista360]", error);

    if (error.code === "STREET_VIEW_NOT_CONFIGURED") {
      return res.status(503).json({
        message: "La verificacion de Street View no esta configurada",
      });
    }

    return res.status(502).json({
      message: "No se pudo consultar Google Street View",
      estado: error.providerStatus || null,
    });
  }
}

// Consultar la vista 360 desde la ficha publica y guardar el resultado
export async function consultarVista360(req, res) {
  try {
    const id = req.params.id;
    const punto = await service.getPuntosById(id);

    if (!punto) {
      return res.status(404).json({ message: "No se encontro el punto" });
    }

    if (punto.vista360?.ultimaVerificacion) {
      return res.status(200).json({ vista360: punto.vista360 });
    }

    const metadata = await consultarStreetViewMetadata({
      lat: punto.lat,
      lon: punto.lon,
      radio: 100,
    });

    const vista360 = {
      habilitada: metadata.disponible,
      disponible: metadata.disponible,
      estado: metadata.estado,
      panoId: metadata.panoId,
      fechaImagen: metadata.fechaImagen,
      copyright: metadata.copyright,
      mensaje: metadata.mensaje,
      ultimaVerificacion: new Date(),
    };

    await service.editarPunto(id, { vista360 });
    return res.status(200).json({ vista360 });
  } catch (error) {
    console.error("[consultarVista360]", error);
    return res.status(502).json({
      message: "No se pudo consultar la vista del lugar",
    });
  }
}

// Agregar contenido externo relacionado con el punto
export async function agregarMultimedia(req, res) {
  try {
    const id = req.params.id;
    const { tipo, url, titulo = "", descripcion = "", fuente = "" } = req.body;

    if (!TIPOS_MULTIMEDIA.has(tipo)) {
      return res.status(400).json({ message: "Tipo de contenido multimedia invalido" });
    }

    if (!validarUrlMultimedia(tipo, url)) {
      return res.status(400).json({ message: "URL multimedia invalida para el tipo indicado" });
    }

    const contenido = {
      _id: new ObjectId(),
      tipo,
      url,
      titulo: String(titulo).trim(),
      descripcion: String(descripcion).trim(),
      fuente: String(fuente).trim(),
      fechaAgregado: new Date(),
    };

    const resultado = await service.agregarMultimedia(id, contenido);
    if (!resultado.matchedCount) {
      return res.status(404).json({ message: "No se encontro el punto" });
    }

    return res.status(201).json({
      message: "Contenido multimedia agregado",
      contenido,
    });
  } catch (error) {
    console.error("[agregarMultimedia]", error);
    return res.status(500).json({ message: "No se pudo agregar el contenido multimedia" });
  }
}

// Eliminar un contenido externo relacionado con el punto
export async function eliminarMultimedia(req, res) {
  try {
    const { id, multimediaId } = req.params;
    const resultado = await service.eliminarMultimedia(id, multimediaId);

    if (!resultado.matchedCount) {
      return res.status(404).json({ message: "No se encontro el punto" });
    }

    if (!resultado.modifiedCount) {
      return res.status(404).json({ message: "Contenido multimedia no encontrado" });
    }

    return res.status(200).json({ message: "Contenido multimedia eliminado" });
  } catch (error) {
    console.error("[eliminarMultimedia]", error);
    return res.status(500).json({ message: "No se pudo eliminar el contenido multimedia" });
  }
}
