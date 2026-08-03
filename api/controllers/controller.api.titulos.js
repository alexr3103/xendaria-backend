import * as serviceTitulos from "../../services/titulos.service.js";
import * as serviceUsuarios from "../../services/usuarios.service.js";
import { responderError } from "../../utils/errores.js";

function puedeVerTitulosUsuario(req, usuario, idUsuario) {
  if (String(req.user?.id) === String(idUsuario)) return true;
  if (req.user?.role === "admin") return true;

  const configuracion = serviceUsuarios.normalizarConfiguracionUsuario(
    usuario?.configuracion
  );

  return configuracion.perfilPublico !== false;
}

export async function getTitulos(req, res) {
  try {
    const titulos = await serviceTitulos.getTitulos({
      incluirInactivos: req.user?.role === "admin" && req.query.incluirInactivos === "true",
    });
    return res.status(200).json(titulos);
  } catch (err) {
    console.error("[getTitulos]", err);
    return res.status(500).json({ message: "No se pudieron obtener los titulos" });
  }
}

export async function crearTitulo(req, res) {
  try {
    const titulo = await serviceTitulos.crearTitulo(req.body);
    return res.status(201).json({
      message: "Titulo creado correctamente",
      titulo,
    });
  } catch (err) {
    console.error("[crearTitulo]", err);
    return responderError(res, err, "No se pudo crear el título");
  }
}

export async function editarTitulo(req, res) {
  try {
    const titulo = await serviceTitulos.editarTitulo(req.params.idTitulo, req.body);
    if (!titulo) return res.status(404).json({ message: "Titulo no encontrado" });

    return res.status(200).json({
      message: "Titulo actualizado correctamente",
      titulo,
    });
  } catch (err) {
    console.error("[editarTitulo]", err);
    return responderError(res, err, "No se pudo actualizar el título");
  }
}

export async function eliminarTitulo(req, res) {
  try {
    const resultado = await serviceTitulos.eliminarTitulo(req.params.idTitulo);
    if (!resultado.deletedCount) {
      return res.status(404).json({ message: "Titulo no encontrado" });
    }

    return res.status(200).json({ message: "Titulo eliminado correctamente" });
  } catch (err) {
    console.error("[eliminarTitulo]", err);
    return res.status(500).json({ message: "No se pudo eliminar el titulo" });
  }
}

export async function getMisTitulos(req, res) {
  try {
    const titulos = await serviceTitulos.getTitulosUsuario(req.user.id);
    return res.status(200).json(titulos);
  } catch (err) {
    console.error("[getMisTitulos]", err);
    return res.status(500).json({ message: "No se pudieron obtener tus titulos" });
  }
}

export async function seleccionarMiTitulo(req, res) {
  try {
    const titulos = await serviceTitulos.seleccionarTituloUsuario(
      req.user.id,
      req.body?.idTitulo
    );

    return res.status(200).json({
      message: "Titulo elegido correctamente",
      ...titulos,
    });
  } catch (err) {
    console.error("[seleccionarMiTitulo]", err);
    return responderError(res, err, "No se pudo elegir el título");
  }
}

export async function getTitulosUsuario(req, res) {
  try {
    const { idUsuario } = req.params;
    const usuario = await serviceUsuarios.getUsuariosById(idUsuario);
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });
    if (
      String(usuario.role || "").toLowerCase() === "admin" &&
      req.user?.role !== "admin"
    ) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!puedeVerTitulosUsuario(req, usuario, idUsuario)) {
      return res.status(403).json({ message: "Este perfil es privado" });
    }

    const titulos = await serviceTitulos.getTitulosUsuario(idUsuario);
    return res.status(200).json(titulos);
  } catch (err) {
    console.error("[getTitulosUsuario]", err);
    return res.status(500).json({ message: "No se pudieron obtener los titulos" });
  }
}
