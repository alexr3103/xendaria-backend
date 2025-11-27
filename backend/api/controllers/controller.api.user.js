import * as serviceUsuarios from "../../services/usuarios.service.js";
import * as servicePuntos from "../../services/puntos_visitables.service.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { getDB } from "../../services/db.js";
import * as emailService from "../../services/email.service.js";

const clientGoogle = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ---------------------------------------------
// LOGIN CON GOOGLE
// ---------------------------------------------
export async function loginGoogle(req, res) {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ message: "Falta credential" });

    // Validar token de Google
    const ticket = await clientGoogle.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const nombre = payload.name;
    const foto = payload.picture;

    // DB desde Railway
    const db = getDB();
    const collection = db.collection("usuarios");

    let usuario = await collection.findOne({ email });

    // Si no existe, crearlo
    if (!usuario) {
      const nuevoUsuario = {
        nombre,
        email,
        foto,
        password: await bcrypt.hash("google_oauth_dummy", 10),
        descripcion: "",
        lugares_favoritos: [],
        role: "user",
      };

      const { insertedId } = await collection.insertOne(nuevoUsuario);
      usuario = { ...nuevoUsuario, _id: insertedId };
    }

    const token = createToken(usuario);

    return res.json({
      message: "Inicio de sesión con Google exitoso",
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        role: usuario.role,
        token,
      },
    });
  } catch (err) {
    console.error("[loginGoogle ERROR]", err);
    return res
      .status(500)
      .json({ message: "Error con autenticación de Google" });
  }
}

// ---------------------------------------------
// CREAR TOKEN
// ---------------------------------------------
function createToken(usuario) {
  const payload = {
    id: usuario._id,
    nombre: usuario.nombre,
    email: usuario.email,
    role: usuario.role,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "2h" });
}

// ---------------------------------------------
// CRUD
// ---------------------------------------------
export async function getUsuarios(req, res) {
  try {
    const usuarios = await serviceUsuarios.getUsuarios(req.query);
    return res.status(200).json(usuarios);
  } catch (e) {
    console.error("[getUsuarios]", e);
    return res.status(500).json({ message: "Error al obtener usuarios" });
  }
}

export async function getUsuariosById(req, res) {
  try {
    const usuario = await serviceUsuarios.getUsuariosById(req.params.id);
    if (!usuario)
      return res.status(404).json({ message: "Usuario no encontrado" });
    return res.status(200).json(usuario);
  } catch (e) {
    console.error("[getUsuariosById]", e);
    return res.status(500).json({ message: "Error al obtener usuario" });
  }
}

export async function nuevoUsuario(req, res) {
  try {
    const { nombre, email, password, foto, descripcion, lugares_favoritos } =
      req.body;

    if (!nombre || !email || !password)
      return res.status(400).json({ message: "Faltan datos obligatorios" });

    const creado = await serviceUsuarios.crearUsuario({
      nombre,
      email,
      password,
      foto: foto || "",
      descripcion: descripcion || "",
      lugares_favoritos: lugares_favoritos || [],
      role: "user",
    });

    const token = createToken(creado);

    return res.status(201).json({
      message: "Usuario creado correctamente",
      id: creado._id,
      nombre,
      email,
      token,
    });
  } catch (err) {
    console.error("[nuevoUsuario]", err);
    return res.status(500).json({ message: "No se guardó el usuario" });
  }
}

// ---------------------------------------------
// LOGIN NORMAL
// ---------------------------------------------
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Faltan datos" });

    const resultado = await serviceUsuarios.loginUsuario(email, password);
    if (!resultado.ok)
      return res.status(resultado.status).json({ message: resultado.msg });

    const token = createToken(resultado.data);

    return res.status(200).json({
      message: "Inicio de sesión exitoso",
      usuario: {
        id: resultado.data._id,
        nombre: resultado.data.nombre,
        email: resultado.data.email,
        role: resultado.data.role,
        token,
      },
    });
  } catch (err) {
    console.error("[login]", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

// ---------------------------------------------
// RECUPERAR CUENTA
// ---------------------------------------------
export function recuperarCuenta(req, res) {
  emailService.recuperarCuenta(req.body.email);
  return res.status(200).json({ message: "ok" });
}

// ---------------------------------------------
// MODIFICAR CONTRASEÑA
// ---------------------------------------------
export function resetPassword(req, res) {
  const { token, password } = req.body;
  serviceUsuarios
    .updatePassword(token, password)
    .then(() => res.status(201).json({ message: "Contraseña actualizada" }))
    .catch(() =>
      res
        .status(400)
        .json({ message: "No se pudo actualizar la contraseña" })
    );
}

// ---------------------------------------------
// NUEVO PUNTO
// ---------------------------------------------
export async function nuevoPunto(req, res) {
  const idUsuario = req.params.idUsuario;
  const punto = {
    categoria: req.body.categoria,
    nombre: req.body.nombre,
    foto: req.body.foto,
    direccion: req.body.direccion,
    descripcion: req.body.descripcion,
    link: req.body.link,
  };

  try {
    const nuevoPunto = await serviceUsuarios.guardarDuenio(
      idUsuario,
      punto,
      true
    );
    return res
      .status(201)
      .json({ message: "Punto creado y agregado al usuario!", nuevoPunto });
  } catch (err) {
    console.error("[nuevoPunto]", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

// ---------------------------------------------
// OBTENER PUNTOS DE USUARIO
// ---------------------------------------------
export async function getPuntoUsuario(req, res) {
  try {
    const puntos = await serviceUsuarios.getPuntoUsuario(
      req.params.idUsuario
    );
    if (!puntos)
      return res.status(404).json({ message: "Usuario no encontrado" });
    return res.status(200).json(puntos);
  } catch (err) {
    console.error("[getPuntoUsuario]", err);
    return res.status(500).json({ message: "Error del servidor" });
  }
}

// ---------------------------------------------
// FAVORITOS
// ---------------------------------------------
export async function nuevoLugarFavorito(req, res) {
  const idUsuario = req.params.idUsuario;
  const idPunto = req.body.idPunto;

  if (!idPunto)
    return res.status(400).json({ message: "Falta idPunto en el body" });

  try {
    const punto = await servicePuntos.getPuntosById(idPunto);
    if (!punto) return res.status(404).json({ message: "Punto no encontrado" });

    await serviceUsuarios.guardarDuenio(idUsuario, punto, false);
    return res.status(201).json({
      message: "Punto agregado a lugares favoritos",
      punto,
    });
  } catch (err) {
    console.error("[nuevoLugarFavorito]", err);
    return res.status(500).json({ message: "Error al agregar favorito" });
  }
}

export async function eliminarLugarFavorito(req, res) {
  const idUsuario = req.params.idUsuario;
  const idPunto = req.params.idPunto;

  if (!idPunto)
    return res.status(400).json({ message: "Falta idPunto en params" });

  try {
    const usuario = await serviceUsuarios.getUsuariosById(idUsuario);
    if (!usuario)
      return res.status(404).json({ message: "Usuario no encontrado" });

    const favoritosActualizados = (usuario.lugares_favoritos || []).filter(
      (fav) => fav.toString() !== idPunto
    );

    await serviceUsuarios.editarUsuario(idUsuario, {
      lugares_favoritos: favoritosActualizados,
    });

    return res.status(200).json({
      message: "Punto eliminado de favoritos",
      favoritos: favoritosActualizados,
    });
  } catch (err) {
    console.error("[eliminarLugarFavorito]", err);
    return res.status(500).json({ message: "Error al quitar favorito" });
  }
}

export async function eliminarUsuario(req, res) {
  try {
    const id = req.params.id;

    const result = await serviceUsuarios.eliminarUsuario(id);

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.status(200).json({
      message: `Usuario eliminado correctamente`,
      id
    });

  } catch (err) {
    console.error("[eliminarUsuario]", err);
    return res.status(500).json({ message: "Error al eliminar usuario" });
  }
}

