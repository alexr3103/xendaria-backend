import * as services from "../services/puntos_visitables.service.js";

// Listar puntos (con o sin filtro por categoría)
export function getPuntos(req, res) {
  const { categoria } = req.query;
  services.getPuntos(req.query)
    .then(puntos => res.send(views.crearListadoPuntos(puntos, categoria)))
    .catch(() => res.send(createPage("Error", "<p>Error al listar puntos</p>")));
}

// Ver detalle de un punto por ID
export function getPuntosById(req, res) {
  const id = req.params.id;
  services.getPuntosById(id)
    .then(punto =>
      punto
        ? res.send(views.crearDetallePunto(punto))
        : res.send(createPage("Error", "<p>Punto no encontrado</p>"))
    )
    .catch(() => res.send(createPage("Error", "<p>Error interno</p>")));
}

// Mostrar formulario para crear nuevo punto
export function formularioNuevoPunto(req, res) {
  res.send(views.formularioNuevoPunto());
}

// Guardar un nuevo punto
export function guardarPunto(req, res) {
  const punto = {
    categoria: req.body.categoria,
    nombre: req.body.nombre,
    lat: req.body.lat || null,
    lon: req.body.lon || null,
    foto: req.body.foto,
    descripcion: req.body.descripcion,
    descripcion_completa: req.body.descripcion_completa || "",
    direccion: req.body.direccion || ""
  };

  services.guardarPunto(punto)
    .then(r => res.redirect(`/puntos/${String(r.insertedId)}`))
    .catch(() => res.send(createPage("Error", "<p>No se pudo guardar el punto</p>")));
}

// Mostrar formulario de modificación
export function formularioModificarPunto(req, res) {
  const id = req.params.id;
  services.getPuntosById(id)
    .then(punto =>
      punto
        ? res.send(views.formularioModificarPunto(punto))
        : res.send(createPage("Error", "<p>Punto no encontrado</p>"))
    )
    .catch(() => res.send(createPage("Error", "<p>Error interno</p>")));
}

// Editar punto (PATCH)
export function editarPunto(req, res) {
  const id = req.params.id;
  const patch = {
    categoria: req.body.categoria,
    nombre: req.body.nombre,
    lat: req.body.lat || null,
    lon: req.body.lon || null,
    foto: req.body.foto,
    descripcion: req.body.descripcion,
    descripcion_completa: req.body.descripcion_completa,
    direccion: req.body.direccion
  };

  services.editarPunto(id, patch)
    .then(() => services.getPuntosById(id))
    .then(punto => res.send(views.crearDetallePunto(punto)))
    .catch(() => res.send(createPage("Error", "<p>No se editó el punto</p>")));
}

// Mostrar formulario de eliminación
export function formularioEliminar(req, res) {
  const id = req.params.id;
  services.getPuntosById(id)
    .then(punto =>
      punto
        ? res.send(views.formularioEliminar(punto))
        : res.send(createPage("Error", "<p>Punto no encontrado</p>"))
    )
    .catch(() => res.send(createPage("Error", "<p>Error interno</p>")));
}

// Eliminar punto
export function eliminarPunto(req, res) {
  const id = req.params.id;
  services.eliminarPunto(id)
    .then(r =>
      r.deletedCount
        ? res.send(views.eliminacionExito(id))
        : res.send(createPage("Error", "<p>Punto no encontrado</p>"))
    )
    .catch(() => res.send(createPage("Error", "<p>No se eliminó el punto</p>")));
}
