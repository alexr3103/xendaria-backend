import * as service from "../../services/puntos_visitables.service.js";

// Obtener todos los puntos
export async function getPuntos(req, res) {
  try {
    const puntos = await service.getPuntos(req.query);
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
    const punto = await service.getPuntosById(id);
    if (!punto) {
      return res.status(404).json({ message: "No se encontró el punto" });
    }
    return res.status(200).json(punto);
  } catch (e) {
    console.error("[getPuntosById]", e);
    return res.status(500).json({ message: "Error al obtener el punto" });
  }
}

// Crear nuevo punto
export async function nuevoPunto(req, res) {
  try {
    const punto = {
      categoria: req.body.categoria || "",
      nombre: req.body.nombre || "",
      lat: req.body.lat || null,
      lon: req.body.lon || null,
      foto: req.body.foto || "",
      descripcion: req.body.descripcion || "",
      descripcion_completa: req.body.descripcion_completa || "",
      direccion: req.body.direccion || "",
      insignia: req.body.insignia || null
    };

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
    const puntoEditado = await service.editarPunto(id, req.body);
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
    const punto = {
      categoria: req.body.categoria || "",
      nombre: req.body.nombre || "",
      lat: req.body.lat || null,
      lon: req.body.lon || null,
      foto: req.body.foto || "",
      descripcion: req.body.descripcion || "",
      descripcion_completa: req.body.descripcion_completa || "",
      direccion: req.body.direccion || "",
      insignia: req.body.insignia|| null
    };

    const puntoEditado = await service.reemplazarPunto(id, punto);
    return res.status(202).json(puntoEditado);
  } catch (e) {
    console.error("[reemplazarPunto]", e);
    return res.status(500).json({ message: "No se pudo reemplazar el punto" });
  }
}
