import * as services from "../services/usuarios.service.js";


export function getUsuarios(req, res) {
    const { filtro } = req.query; // de acá salen los botones
    services.getUsuarios(req.query)
        .then(usuarios => res.send(views.crearListadoUsuarios(usuarios, filtro, req.query.nombreContiene)))
        .catch(() => res.send(createPage("Error", "<p>Error al listar usuarios</p>")));
}

export function getUsuariosById(req, res) {
    const id = req.params.id;
    services.getUsuariosById(id)
        .then(usuario => usuario ? res.send(views.crearDetalleUsuario(usuario)) : res.send(createPage("Error", "<p>Usuario no encontrado</p>")))
        .catch(() => res.send(createPage("Error", "<p>Error interno</p>")));
}

export function formularioNuevoUsuario(req, res) {
    res.send(views.formularioNuevoUsuario());
}

export function guardarUsuario(req, res) {
    const usuario = {
        nombre:             req.body.nombre,
        foto:               req.body.foto,
        descripcion:        req.body.descripcion,
        lugares_favoritos:  req.body.lugares_favoritos
        };
    services.guardarUsuario(usuario)
        .then(r => res.redirect(`/usuarios/${String(r.insertedId)}`))
        .catch(() => res.send(createPage("Error", "<p>No se pudo guardar el usuario</p>`")));

}

export function formularioModificarUsuario(req, res) {
    const id = req.params.id;
    services.getUsuariosById(id)
        .then(usuario => usuario ? res.send(views.formularioModificarUsuario(usuario)) : res.send(createPage("Error", "<p>Usuario no encontrado</p>")))
        .catch(() => res.send(createPage("Error", "<p>Error interno</p>")));
}

export function editarUsuario(req, res) {
    const id = req.params.id;
    const patch = {
        nombre:             req.body.nombre,
        foto:               req.body.foto,
        descripcion:        req.body.descripcion,
        lugares_favoritos:  req.body.lugares_favoritos
    };
    services.editarUsuario(id, patch)
        .then(() => services.getUsuariosById(id))
        .then(usuario => res.send(views.crearDetalleUsuario(usuario)))
        .catch(() => res.send(createPage("Error", "<p>No se editó el usuario</p>")));
}

export function formularioEliminarUsuario(req, res) {
    const id = req.params.id;
    services.getUsuariosById(id)
        .then(usuario => usuario ? res.send(views.formularioEliminarUsuario(usuario)) : res.send(createPage("Error", "<p>Usuario no encontrado</p>")))
        .catch(() => res.send(createPage("Error", "<p>Error interno</p>")));
}

export function eliminarUsuario(req, res) {
    const id = req.params.id;
        services.eliminarUsuario(id)
        .then(r => r.deletedCount ? res.send(views.eliminacionExito(id)) : res.send(createPage("Error", "<p>Usuario no encontrado</p>")))
        .catch(() => res.send(createPage("Error", "<p>No se eliminó el usuario</p>")));
}
