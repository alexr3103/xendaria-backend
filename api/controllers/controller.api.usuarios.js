import * as serviceUsuarios from "../../services/usuarios.service.js";
import * as servicePuntos from "../../services/puntos_visitables.service.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import * as emailService from '../../services/email.service.js'
import { consultarStreetViewMetadata } from "../../services/streetview.service.js";
import { emitRankingUpdated } from "../../services/socket.service.js";



const clientGoogle = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);//login con google
const CONFIGURACION_DEFAULT = serviceUsuarios.CONFIGURACION_USUARIO_DEFAULT;
const DESCRIPCION_USUARIO_MAX_LENGTH = 150;
const TOKEN_EXPIRATION_USER = "15d";
const TOKEN_EXPIRATION_ADMIN = "8h";
const GOOGLE_OAUTH_DUMMY_PASSWORD = "google_oauth_dummy";
const PASSWORD_RULES = [
  {
    test: (value) => String(value || "").length >= 6,
    message: "La contraseña debe tener al menos 6 caracteres",
  },
  {
    test: (value) => /[0-9]/.test(String(value || "")),
    message: "La contraseña debe tener al menos un número",
  },
  {
    test: (value) => /[A-Z]/.test(String(value || "")),
    message: "La contraseña debe tener al menos una mayúscula",
  },
  {
    test: (value) => /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(String(value || "")),
    message: "La contraseña debe tener al menos un caracter especial",
  },
];

function esFotoGoogle(value = "") {
  return /googleusercontent\.com|ggpht\.com/i.test(String(value));
}

function validarPassword(password = "") {
  const reglaInvalida = PASSWORD_RULES.find((rule) => !rule.test(password));
  return reglaInvalida?.message || "";
}

async function esCuentaSoloGoogle(usuario = {}) {
  if (!usuario.password || !usuario.fotoGoogle) return false;
  return bcrypt.compare(GOOGLE_OAUTH_DUMMY_PASSWORD, usuario.password);
}

export async function loginGoogle(req, res) {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: "Falta credential" });


    const ticket = await clientGoogle.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const nombre = payload.name;
    const foto = payload.picture;

    let usuario = await serviceUsuarios.getUsuarioByEmail(email);

    if (!usuario) {
      const nuevo = {
        nombre,
        email,
        foto,
        fotoGoogle: foto,
        password: GOOGLE_OAUTH_DUMMY_PASSWORD,
        descripcion: "",
        lugares_favoritos: [],
        puntos_visitados: [],
        insignias: [],
        seguidores: [],
        siguiendo: [],
        configuracion: serviceUsuarios.normalizarConfiguracionUsuario(),
        role: "user"
      };
      const { insertedId } = await serviceUsuarios.guardarUsuario(nuevo);
      usuario = { ...nuevo, _id: insertedId };
    } else {
      const dataGoogle = {
        fotoGoogle: foto,
      };

      if (!usuario.foto) dataGoogle.foto = foto;

      await serviceUsuarios.editarUsuario(usuario._id.toString(), dataGoogle);
      usuario = {
        ...usuario,
        ...dataGoogle,
      };
    }

    const token = createToken(usuario);

    res.json({
      message: "Inicio de sesión con Google exitoso",
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        foto: usuario.foto || "",
        fotoGoogle: usuario.fotoGoogle || "",
        descripcion: usuario.descripcion || "",
        configuracion: serviceUsuarios.normalizarConfiguracionUsuario(usuario.configuracion),
        role: usuario.role,
        token
      }
    });
  } catch (err) {
    console.error("[loginGoogle]", err);
    res.status(500).json({ message: "Error con autenticación de Google" });
  }
}


//Crear token
function createToken(usuario) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET no configurado");
  }

  const payload = {
    id: usuario._id,
    nombre: usuario.nombre,
    email: usuario.email,
    role: usuario.role
  };

  const expiresIn =
    String(usuario.role || "").toLowerCase() === "admin"
      ? TOKEN_EXPIRATION_ADMIN
      : TOKEN_EXPIRATION_USER;

  return jwt.sign(payload, secret, { expiresIn });
}

//Traer todos los usuarios
export async function getUsuarios(req, res) {
  try {
    const usuarios = await serviceUsuarios.getUsuarios(req.query);
    return res.status(200).json(usuarios);
  } catch (e) {
    console.error("[getUsuarios]", e);
    res.status(500).json({ message: "Error al obtener usuarios" });
  }
}

export async function getResumenPuntosPropiosAdmin(req, res) {
  try {
    const resumen = await serviceUsuarios.getResumenPuntosPropiosAdmin();
    return res.status(200).json(resumen);
  } catch (e) {
    console.error("[getResumenPuntosPropiosAdmin]", e);
    return res.status(500).json({ message: "Error al obtener puntos propios" });
  }
}

//Traer usuario por ID
export async function getUsuariosById(req, res) {
  try {
    const id = req.params.id;
    const usuario = await serviceUsuarios.getUsuariosById(id);
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });
    res.status(200).json(prepararUsuarioParaRespuesta(usuario, req, id));
  } catch (e) {
    console.error("[getUsuariosById]", e);
    res.status(500).json({ message: "Error al obtener usuario" });
  }
}

//Registrar nuevo usuario (con email y password)
export async function nuevoUsuario(req, res) {
  try {
    const { nombre, email, password, foto, descripcion, lugares_favoritos } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    // Verificar si ya existe
    const existe = await serviceUsuarios.getUsuarioByEmail(email);
    if (existe) {
      return res.status(400).json({ message: "El email ya está registrado" });
    }

    const usuario = {
      nombre,
      email,
      password,
      foto: foto || "",
      descripcion: normalizarDescripcionUsuario(descripcion) || "",
      lugares_favoritos: lugares_favoritos || [],
      puntos_visitados: [],
      insignias: [],
      seguidores: [],
      siguiendo: [],
      configuracion: serviceUsuarios.normalizarConfiguracionUsuario(),
      role: "user"
    };

    const usuarioNuevo = await serviceUsuarios.guardarUsuario(usuario);
    const usuarioConId = { ...usuario, _id: usuarioNuevo.insertedId };
    const token = createToken(usuarioConId);

    res.status(201).json({
      message: "Usuario creado correctamente",
      id: usuarioNuevo.insertedId,
      nombre,
      email,
      token
    });
  } catch (err) {
    console.error("[nuevoUsuario]", err);
    res.status(500).json({ message: "No se guardó el usuario" });
  }
}

//Eliminar usuario
export async function eliminarUsuario(req, res) {
  try {
    const id = req.params.id;
    const resultado = await serviceUsuarios.eliminarUsuario(id);

    if (!resultado.deletedCount) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({
      message: `Usuario eliminado correctamente: ${id}`,
      puntosPropiosEliminados: resultado.puntosPropiosEliminados || 0,
    });
  } catch (err) {
    console.error("[eliminarUsuario]", err);
    res.status(500).json({ message: "Error al eliminar usuario" });
  }
}

//Editar usuario (actualiza contraseña si viene nueva)
export async function editarUsuario(req, res) {
  try {
    const id = req.params.id;

    if (!usuarioPuedeGestionar(req, id) && req.user?.role !== "admin") {
      return res.status(403).json({ message: "No podes editar otro usuario" });
    }

    const usuarioActual = await serviceUsuarios.getUsuariosById(id);
    if (!usuarioActual) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const data = limpiarCamposVacios({
      nombre: req.body.nombre,
      foto: req.body.foto,
      fotoGoogle: esFotoGoogle(req.body.fotoGoogle) ? req.body.fotoGoogle : undefined,
      descripcion: normalizarDescripcionUsuario(req.body.descripcion),
    });

    if (req.body.configuracion !== undefined) {
      data.configuracion = serviceUsuarios.normalizarConfiguracionUsuario(
        req.body.configuracion,
        usuarioActual.configuracion
      );
    }

    if (req.user?.role === "admin") {
      if (req.body.role !== undefined) data.role = req.body.role;
      if (req.body.email !== undefined) data.email = req.body.email;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No hay datos para editar" });
    }

    await serviceUsuarios.editarUsuario(id, data);
    const usuarioActualizado = await serviceUsuarios.getUsuariosById(id);
    const { password, ...usuarioSeguro } = usuarioActualizado;

    return res.status(200).json({
      message: "Perfil actualizado correctamente",
      usuario: usuarioSeguro,
    });
  } catch (err) {
    console.error("[editarUsuario]", err);
    res.status(500).json({ message: "No se editó el usuario" });
  }
}

export async function cambiarPasswordUsuario(req, res) {
  try {
    const id = req.params.id;

    if (!usuarioPuedeGestionar(req, id)) {
      return res.status(403).json({ message: "No podes cambiar la contraseña de otro usuario" });
    }

    const { passwordActual, passwordNueva, passwordConfirm } = req.body;

    if (!passwordActual || !passwordNueva || !passwordConfirm) {
      return res.status(400).json({ message: "Completá todos los campos de contraseña" });
    }

    if (passwordNueva !== passwordConfirm) {
      return res.status(400).json({ message: "Las contraseñas nuevas deben coincidir" });
    }

    const errorPassword = validarPassword(passwordNueva);
    if (errorPassword) {
      return res.status(400).json({ message: errorPassword });
    }

    const usuario = await serviceUsuarios.getUsuarioAuthById(id);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!usuario.password || (await esCuentaSoloGoogle(usuario))) {
      return res.status(400).json({
        message: "Esta cuenta usa Google para iniciar sesión. No tiene una contraseña de Xendaria para cambiar.",
      });
    }

    const actualValida = await bcrypt.compare(
      String(passwordActual).trim(),
      usuario.password
    );

    if (!actualValida) {
      return res.status(401).json({ message: "La contraseña actual no es correcta" });
    }

    const repitePassword = await bcrypt.compare(
      String(passwordNueva).trim(),
      usuario.password
    );

    if (repitePassword) {
      return res.status(400).json({ message: "La contraseña nueva debe ser distinta a la actual" });
    }

    await serviceUsuarios.editarUsuario(id, {
      password: await bcrypt.hash(String(passwordNueva).trim(), 10),
    });

    return res.status(200).json({ message: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error("[cambiarPasswordUsuario]", err);
    return res.status(500).json({ message: "No se pudo cambiar la contraseña" });
  }
}

export async function buscarUsuariosComunidad(req, res) {
  try {
    const usuarios = await serviceUsuarios.buscarUsuariosComunidad(
      {
        nombreContiene: req.query.q || req.query.nombreContiene || "",
        limit: req.query.limit,
      },
      req.user.id
    );

    if (!usuarios) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.status(200).json(usuarios);
  } catch (err) {
    console.error("[buscarUsuariosComunidad]", err);
    return res.status(500).json({ message: "No se pudo buscar usuarios" });
  }
}

export async function getComunidadUsuario(req, res) {
  try {
    const comunidad = await serviceUsuarios.getComunidadUsuario(req.user.id);

    if (!comunidad) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.status(200).json(comunidad);
  } catch (err) {
    console.error("[getComunidadUsuario]", err);
    return res.status(500).json({ message: "No se pudo obtener tu comunidad" });
  }
}

export async function seguirUsuario(req, res) {
  try {
    const usuario = await serviceUsuarios.seguirUsuario(
      req.user.id,
      req.params.idObjetivo
    );

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.status(200).json({
      message: "Usuario agregado a tu comunidad",
      usuario,
    });
  } catch (err) {
    console.error("[seguirUsuario]", err);
    return res
      .status(err.status || 500)
      .json({ message: err.message || "No se pudo seguir al usuario" });
  }
}

export async function dejarDeSeguirUsuario(req, res) {
  try {
    const usuario = await serviceUsuarios.dejarDeSeguirUsuario(
      req.user.id,
      req.params.idObjetivo
    );

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.status(200).json({
      message: "Usuario quitado de tu comunidad",
      usuario,
    });
  } catch (err) {
    console.error("[dejarDeSeguirUsuario]", err);
    return res.status(500).json({ message: "No se pudo dejar de seguir al usuario" });
  }
}

/* //Reemplazar usuario
export async function reemplazarUsuario(req, res) {
  try {
    const id = req.params.id;
    const usuario = {
      nombre: req.body.nombre,
      email: req.body.email,
      password: req.body.password ? await bcrypt.hash(req.body.password, 10) : undefined,
      foto: req.body.foto,
      descripcion: req.body.descripcion,
      lugares_favoritos: req.body.lugares_favoritos
    };
    const usuarioEditado = await serviceUsuarios.reemplazarUsuario(id, usuario);
    res.status(202).json(usuarioEditado);
  } catch (err) {
    console.error("[reemplazarUsuario]", err);
    res.status(500).json({ message: "No se guardó el usuario" });
  }
} */

//Login
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Faltan datos" });
    }

    const usuario = await serviceUsuarios.getUsuarioByEmail(email);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const valido = await bcrypt.compare(password.trim(), usuario.password.trim());

    if (!valido) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    const token = createToken(usuario);

    res.status(200).json({
      message: "Inicio de sesión exitoso",
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        foto: usuario.foto || "",
        fotoGoogle: usuario.fotoGoogle || "",
        descripcion: usuario.descripcion || "",
        configuracion: serviceUsuarios.normalizarConfiguracionUsuario(usuario.configuracion),
        role: usuario.role,
        token
      }
    });

  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

// Recuperar cuenta
export function recuperarCuenta(req, res) {
  const email = req.body.email
  emailService.recuperarCuenta(email)
  res.status(200).json({ message: "ok" })
}

// Recuperar contraseña
export function resetPassword(req, res){
  const { token, password } = req.body
  serviceUsuarios.updatePassword(token, password)
      .then( () => res.status(201).json({message: "Contraseña actualizada"}) )
      .catch( (err) => res.status(400).json({message: "No se pudo actualizar la contraseña"}) )
}

function usuarioPuedeGestionar(req, idUsuario) {
  return String(req.user?.id) === String(idUsuario);
}

function usuarioPuedeVerDatosPrivados(req, idUsuario) {
  return usuarioPuedeGestionar(req, idUsuario) || req.user?.role === "admin";
}

function prepararUsuarioParaRespuesta(usuario, req, idUsuario) {
  const { password, ...usuarioSeguro } = usuario;
  const configuracion = serviceUsuarios.normalizarConfiguracionUsuario(
    usuario.configuracion
  );

  const respuesta = {
    ...usuarioSeguro,
    configuracion,
    seguidoresCount: Array.isArray(usuario.seguidores)
      ? usuario.seguidores.length
      : 0,
    siguiendoCount: Array.isArray(usuario.siguiendo)
      ? usuario.siguiendo.length
      : 0,
  };

  if (usuarioPuedeVerDatosPrivados(req, idUsuario)) {
    return respuesta;
  }

  delete respuesta.email;
  delete respuesta.role;
  delete respuesta.seguidores;
  delete respuesta.siguiendo;

  if (!configuracion.perfilPublico) {
    delete respuesta.descripcion;
    delete respuesta.lugares_favoritos;
    delete respuesta.puntos_visitados;
    delete respuesta.insignias;
    respuesta.configuracion = {
      perfilPublico: false,
    };
    return respuesta;
  }

  if (!configuracion.mostrarFavoritosPerfil) {
    delete respuesta.lugares_favoritos;
  }

  if (!configuracion.mostrarPuntosVisitadosPerfil) {
    delete respuesta.puntos_visitados;
  }

  if (!configuracion.mostrarInsigniasPerfil) {
    delete respuesta.insignias;
  }

  if (!configuracion.mostrarPreferenciaLugaresPerfil) {
    respuesta.configuracion = {
      ...configuracion,
      categoriaFavorita: "",
    };
  }

  return respuesta;
}

function favoritosVisiblesPara(usuario, req, idUsuario) {
  if (usuarioPuedeGestionar(req, idUsuario)) return true;

  const configuracion = {
    ...CONFIGURACION_DEFAULT,
    ...(usuario.configuracion || {}),
  };

  return Boolean(
    configuracion.perfilPublico &&
    configuracion.mostrarFavoritosPerfil
  );
}

function albumInsigniasVisiblePara(usuario, req, idUsuario) {
  if (usuarioPuedeGestionar(req, idUsuario)) return true;

  const configuracion = serviceUsuarios.normalizarConfiguracionUsuario(
    usuario.configuracion
  );

  return Boolean(
    configuracion.perfilPublico &&
    configuracion.mostrarAlbumInsigniasPerfil
  );
}

function puntosVisitadosVisiblesPara(usuario, req, idUsuario) {
  if (usuarioPuedeGestionar(req, idUsuario)) return true;

  const configuracion = serviceUsuarios.normalizarConfiguracionUsuario(usuario.configuracion);

  return Boolean(
    configuracion.perfilPublico &&
    configuracion.mostrarPuntosVisitadosPerfil
  );
}

function limpiarCamposVacios(objeto) {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, value]) => value !== undefined)
  );
}

function normalizarDescripcionUsuario(descripcion) {
  if (descripcion === undefined) return undefined;
  return String(descripcion).trim().slice(0, DESCRIPCION_USUARIO_MAX_LENGTH);
}

function normalizarCoordenadasPuntoPropio(lat, lon) {
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

// Crear nuevo punto privado asociado al usuario
export async function nuevoPunto(req, res) {
  const idUsuario = req.params.idUsuario;

  if (!usuarioPuedeGestionar(req, idUsuario)) {
    return res.status(403).json({ message: "No podes crear puntos para otro usuario" });
  }

  const punto = limpiarCamposVacios({
    categoria: req.body.categoria,
    nombre: req.body.nombre,
    foto: req.body.foto,
    fotoKey: req.body.fotoKey,
    direccion: req.body.direccion,
    descripcion: req.body.descripcion,
    descripcion_completa: req.body.descripcion_completa,
    link: req.body.link,
    lat: req.body.lat,
    lon: req.body.lon,
    ubicacion: req.body.ubicacion,
  });

  try {
    const nuevoPunto = await serviceUsuarios.crearPuntoPropio(idUsuario, punto);
    res.status(201).json({ message: "Punto propio creado correctamente", nuevoPunto });
  } catch (err) {
    console.error("[nuevoPunto]", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

// Obtener puntos privados creados por el usuario
export async function getPuntoUsuario(req, res) {
  const idUsuario = req.params.idUsuario;

  if (!usuarioPuedeGestionar(req, idUsuario)) {
    return res.status(403).json({ message: "No podes ver puntos de otro usuario" });
  }

  try {
    const usuario = await serviceUsuarios.getUsuariosById(idUsuario);
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

    const puntos = await serviceUsuarios.getPuntosPropios(idUsuario);
    res.status(200).json(puntos);
  } catch (err) {
    console.error("[getPuntoUsuario]", err);
    res.status(500).json({ message: "Error del servidor" });
  }
}

export async function getPuntoPropioById(req, res) {
  const { idUsuario, idPunto } = req.params;

  if (!usuarioPuedeGestionar(req, idUsuario)) {
    return res.status(403).json({ message: "No podes ver puntos de otro usuario" });
  }

  try {
    const punto = await serviceUsuarios.getPuntoPropioById(idUsuario, idPunto);
    if (!punto) return res.status(404).json({ message: "Punto propio no encontrado" });

    res.status(200).json(punto);
  } catch (err) {
    console.error("[getPuntoPropioById]", err);
    res.status(500).json({ message: "Error del servidor" });
  }
}

export async function editarPuntoPropio(req, res) {
  const { idUsuario, idPunto } = req.params;

  if (!usuarioPuedeGestionar(req, idUsuario)) {
    return res.status(403).json({ message: "No podes editar puntos de otro usuario" });
  }

  try {
    const puntoActual = await serviceUsuarios.getPuntoPropioById(idUsuario, idPunto);
    if (!puntoActual) return res.status(404).json({ message: "Punto propio no encontrado" });

    const data = limpiarCamposVacios({
      categoria: req.body.categoria,
      nombre: req.body.nombre,
      foto: req.body.foto,
      fotoKey: req.body.fotoKey,
      direccion: req.body.direccion,
      descripcion: req.body.descripcion,
    });

    if (req.body.lat !== undefined || req.body.lon !== undefined) {
      const coordenadas = normalizarCoordenadasPuntoPropio(
        req.body.lat ?? puntoActual.lat,
        req.body.lon ?? puntoActual.lon
      );

      if (!coordenadas) {
        return res.status(400).json({ message: "Coordenadas invalidas" });
      }

      Object.assign(data, coordenadas, {
        vista360: {
          habilitada: false,
          disponible: false,
          estado: null,
          panoId: null,
          mensaje: "Vista 360 todavia no verificada",
          ultimaVerificacion: null,
        },
      });
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No hay datos para editar" });
    }

    await servicePuntos.editarPunto(idPunto, data);

    const puntoEditado = await serviceUsuarios.getPuntoPropioById(idUsuario, idPunto);
    return res.status(200).json({
      message: "Punto propio editado correctamente",
      punto: puntoEditado,
    });
  } catch (err) {
    console.error("[editarPuntoPropio]", err);
    res.status(500).json({ message: "Error al editar punto propio" });
  }
}

export async function eliminarPuntoPropio(req, res) {
  const { idUsuario, idPunto } = req.params;

  if (!usuarioPuedeGestionar(req, idUsuario)) {
    return res.status(403).json({ message: "No podes eliminar puntos de otro usuario" });
  }

  try {
    const resultado = await serviceUsuarios.eliminarPuntoPropio(idUsuario, idPunto);

    if (!resultado?.deletedCount) {
      return res.status(404).json({ message: "Punto propio no encontrado" });
    }

    return res.status(200).json({
      message: "Punto propio eliminado correctamente",
      idPunto,
    });
  } catch (err) {
    console.error("[eliminarPuntoPropio]", err);
    return res.status(500).json({ message: "Error al eliminar punto propio" });
  }
}

export async function consultarVista360PuntoPropio(req, res) {
  const { idUsuario, idPunto } = req.params;

  if (!usuarioPuedeGestionar(req, idUsuario)) {
    return res.status(403).json({ message: "No podes consultar puntos de otro usuario" });
  }

  try {
    const punto = await serviceUsuarios.getPuntoPropioById(idUsuario, idPunto);
    if (!punto) return res.status(404).json({ message: "Punto propio no encontrado" });

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

    await servicePuntos.editarPunto(idPunto, { vista360 });
    return res.status(200).json({ vista360 });
  } catch (error) {
    console.error("[consultarVista360PuntoPropio]", error);

    if (error.code === "STREET_VIEW_NOT_CONFIGURED") {
      return res.status(503).json({
        message: "La verificacion de Street View no esta configurada",
      });
    }

    return res.status(502).json({
      message: "No se pudo consultar la vista del lugar",
    });
  }
}

export async function getFavoritosUsuario(req, res) {
  const idUsuario = req.params.idUsuario;

  try {
    const usuario = await serviceUsuarios.getUsuariosById(idUsuario);
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

    if (!favoritosVisiblesPara(usuario, req, idUsuario)) {
      return res.status(403).json({ message: "Los favoritos de este perfil son privados" });
    }

    const favoritos = await serviceUsuarios.getFavoritosUsuario(idUsuario);

    res.status(200).json(favoritos);
  } catch (err) {
    console.error("[getFavoritosUsuario]", err);
    res.status(500).json({ message: "Error al obtener favoritos" });
  }
}

export async function getAlbumInsigniasUsuario(req, res) {
  const idUsuario = req.params.idUsuario;

  try {
    const usuario = await serviceUsuarios.getUsuariosById(idUsuario);
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

    if (!albumInsigniasVisiblePara(usuario, req, idUsuario)) {
      return res.status(403).json({ message: "El álbum de insignias de este perfil es privado" });
    }

    const album = await serviceUsuarios.getAlbumInsigniasUsuario(idUsuario);

    res.status(200).json(album);
  } catch (err) {
    console.error("[getAlbumInsigniasUsuario]", err);
    res.status(500).json({ message: "Error al obtener álbum de insignias" });
  }
}

export async function getPuntosVisitadosUsuario(req, res) {
  const idUsuario = req.params.idUsuario;

  try {
    const usuario = await serviceUsuarios.getUsuariosById(idUsuario);
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

    if (!puntosVisitadosVisiblesPara(usuario, req, idUsuario)) {
      return res.status(403).json({ message: "Los puntos visitados de este perfil son privados" });
    }

    const visitados = await serviceUsuarios.getPuntosVisitadosUsuario(idUsuario);
    if (!visitados) return res.status(404).json({ message: "Usuario no encontrado" });

    return res.status(200).json(visitados);
  } catch (err) {
    console.error("[getPuntosVisitadosUsuario]", err);
    return res.status(500).json({ message: "Error al obtener puntos visitados" });
  }
}

export async function borrarHistorialVisitas(req, res) {
  const idUsuario = req.params.idUsuario;

  if (!usuarioPuedeGestionar(req, idUsuario)) {
    return res.status(403).json({ message: "No podes borrar visitas de otro usuario" });
  }

  try {
    const resultado = await serviceUsuarios.borrarHistorialVisitas(idUsuario);
    if (!resultado) return res.status(404).json({ message: "Usuario no encontrado" });

    emitRankingUpdated({
      reason: "visit-history-deleted",
      idUsuario,
    });

    return res.status(200).json({
      message: "Historial de visitas borrado correctamente",
      visitasEliminadas: resultado.visitasEliminadas,
    });
  } catch (err) {
    console.error("[borrarHistorialVisitas]", err);
    return res.status(500).json({ message: "Error al borrar historial de visitas" });
  }
}

export async function registrarPuntoVisitado(req, res) {
  const idUsuario = req.params.idUsuario;
  const idPunto = req.body.idPunto;

  if (!usuarioPuedeGestionar(req, idUsuario)) {
    return res.status(403).json({ message: "No podes registrar visitas de otro usuario" });
  }

  try {
    const resultado = await serviceUsuarios.registrarPuntoVisitado(idUsuario, idPunto);
    if (!resultado) return res.status(404).json({ message: "Usuario no encontrado" });
    if (!resultado.punto) return res.status(404).json({ message: "Punto no encontrado" });

    if (resultado.nuevaVisita) {
      emitRankingUpdated({
        reason: "visit-created",
        idUsuario,
        idPunto,
      });
    }

    return res.status(resultado.yaVisitado ? 200 : 201).json({
      message: resultado.yaVisitado
        ? "Este punto ya estaba registrado como visitado"
        : "Punto registrado como visitado",
      yaVisitado: resultado.yaVisitado,
      totalVisitados: resultado.totalVisitados,
      visitados: resultado.visitados,
      punto: resultado.punto,
    });
  } catch (err) {
    console.error("[registrarPuntoVisitado]", err);
    return res.status(500).json({ message: "Error al registrar punto visitado" });
  }
}

// Agregar punto publico existente como favorito
export async function nuevoLugarFavorito(req, res) {
  const idUsuario = req.params.idUsuario;
  const idPunto = req.body.idPunto;

  if (!usuarioPuedeGestionar(req, idUsuario)) {
    return res.status(403).json({ message: "No podes modificar favoritos de otro usuario" });
  }

  if (!idPunto) return res.status(400).json({ message: "Falta idPunto en el body" });

  try {
    const punto = await servicePuntos.getPuntosById(idPunto);
    if (!punto || punto.creadoPor || punto.visibilidad === "privado") {
      return res.status(404).json({ message: "Punto no encontrado" });
    }

    const favoritos = await serviceUsuarios.agregarFavorito(idUsuario, idPunto);
    if (!favoritos) return res.status(404).json({ message: "Usuario no encontrado" });

    res.status(201).json({
      message: "Punto agregado a lugares favoritos",
      favoritos,
      punto,
    });
  } catch (err) {
    console.error("[nuevoLugarFavorito]", err);
    res.status(500).json({ message: "Error al agregar lugar favorito" });
  }
}

// Quitar punto de favoritos
export async function eliminarLugarFavorito(req, res) {
  const idUsuario = req.params.idUsuario;
  const idPunto = req.params.idPunto;

  if (!usuarioPuedeGestionar(req, idUsuario)) {
    return res.status(403).json({ message: "No podes modificar favoritos de otro usuario" });
  }

  if (!idPunto) {
    return res.status(400).json({ message: "Falta idPunto en params" });
  }

  try {
    const favoritosActualizados = await serviceUsuarios.eliminarFavorito(idUsuario, idPunto);
    if (!favoritosActualizados) return res.status(404).json({ message: "Usuario no encontrado" });

    return res.status(200).json({
      message: "Punto eliminado de favoritos",
      favoritos: favoritosActualizados,
    });

  } catch (err) {
    console.error("[eliminarLugarFavorito]", err);
    res.status(500).json({ message: "Error al quitar favorito" });
  }
}
