import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getDB } from "./db.js";
import * as servicePuntos from "./puntos_visitables.service.js";
import * as serviceVisitas from "./visitas.service.js";

function collection() {
  const db = getDB();
  return db.collection("usuarios");
}

export const CONFIGURACION_USUARIO_DEFAULT = {
  perfilPublico: true,
  mostrarFavoritosPerfil: true,
  mostrarInsigniasPerfil: true,
  mostrarAlbumInsigniasPerfil: true,
  mostrarContadorVisitados: true,
  mostrarPuntosVisitadosPerfil: true,
  mostrarPreferenciaLugaresPerfil: true,
  mostrarActividadRanking: true,
  permitirUbicacion: true,
  vista360Habilitada: true,
  categoriaFavorita: "",
  notificaciones: {
    puntosCercanos: true,
    insignias: true,
    recompensas: true,
  },
};

export function normalizarConfiguracionUsuario(configuracion = {}, configuracionActual = {}) {
  const config = configuracion || {};
  const actual = configuracionActual || {};

  return {
    ...CONFIGURACION_USUARIO_DEFAULT,
    ...actual,
    ...config,
    notificaciones: {
      ...CONFIGURACION_USUARIO_DEFAULT.notificaciones,
      ...(actual.notificaciones || {}),
      ...(config.notificaciones || {}),
    },
  };
}

// Filtros flexibles
function _escapeRegex(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _expandDiacritics(s = "") {
  const map = {
    a: "[aáàäâãå]",
    A: "[AÁÀÄÂÃÅ]",
    e: "[eéèëê]",
    E: "[EÉÈËÊ]",
    i: "[iíìïî]",
    I: "[IÍÌÏÎ]",
    o: "[oóòöôõ]",
    O: "[OÓÒÖÔÕ]",
    u: "[uúùüû]",
    U: "[UÚÙÜÛ]",
    n: "[nñ]",
    N: "[NÑ]",
    c: "[cç]",
    C: "[CÇ]",
  };
  const esc = _escapeRegex(s);
  return esc.replace(/[aeiouncAEIOUNC]/g, (ch) => map[ch] || ch);
}

function buildFuzzyRegexes(text = "") {
  const t = text.trim();
  if (!t) return [];
  const base = _expandDiacritics(t);
  const regs = [];
  regs.push(new RegExp(base, "i"));
  for (let i = 0; i < t.length; i++) {
    const before = _expandDiacritics(t.slice(0, i));
    const after = _expandDiacritics(t.slice(i + 1));
    regs.push(new RegExp(before + "." + after, "i"));
  }
  regs.push(new RegExp("^" + base, "i"));
  return regs;
}

function normalizarIdUsuario(valor) {
  if (!valor) return null;
  if (valor instanceof ObjectId) return valor.toString();
  if (typeof valor === "string") return valor;
  if (valor._id instanceof ObjectId) return valor._id.toString();
  if (typeof valor._id === "string") return valor._id;
  return null;
}

function normalizarListaIdsUsuarios(lista = []) {
  return lista
    .map(normalizarIdUsuario)
    .filter((id) => id && ObjectId.isValid(id));
}

function serializarUsuarioComunidad(usuario, usuarioActual = null) {
  const config = normalizarConfiguracionUsuario(usuario.configuracion);
  const siguiendoActual = new Set(
    normalizarListaIdsUsuarios(usuarioActual?.siguiendo || [])
  );
  const seguidoresActual = new Set(
    normalizarListaIdsUsuarios(usuarioActual?.seguidores || [])
  );
  const id = usuario._id.toString();

  return {
    _id: id,
    nombre: usuario.nombre || "Usuario",
    foto: usuario.foto || "",
    descripcion: config.perfilPublico ? usuario.descripcion || "" : "",
    perfilPublico: config.perfilPublico,
    seguidoresCount: normalizarListaIdsUsuarios(usuario.seguidores || []).length,
    siguiendoCount: normalizarListaIdsUsuarios(usuario.siguiendo || []).length,
    loSigo: siguiendoActual.has(id),
    meSigue: seguidoresActual.has(id),
  };
}

export async function getUsuarios(filter = {}) {
  const condiciones = [];

  if (filter.filtro === "Con favoritos") {
    condiciones.push({ "lugares_favoritos.0": { $exists: true } });
  } else if (filter.filtro === "Sin favoritos") {
    condiciones.push({
      $or: [
        { lugares_favoritos: { $exists: false } },
        { "lugares_favoritos.0": { $exists: false } },
      ],
    });
  }

  if (filter.nombreContiene) {
    const regs = buildFuzzyRegexes(String(filter.nombreContiene));
    condiciones.push({
      $or: regs.flatMap((rx) => [{ nombre: rx }, { email: rx }]),
    });
  }

  const filterMongo =
    condiciones.length === 0
      ? {}
      : condiciones.length === 1
      ? condiciones[0]
      : { $and: condiciones };

  const usuarios = await collection().find(filterMongo).toArray();
  return usuarios.map((usuario) => {
    const { password, ...usuarioSeguro } = usuario;

    return {
      ...usuarioSeguro,
      configuracion: normalizarConfiguracionUsuario(usuario.configuracion),
    };
  });
}

export async function getUsuariosById(id) {
  const usuario = await collection().findOne({ _id: new ObjectId(id) });
  if (!usuario) return null;

  const { password, ...usuarioSeguro } = usuario;

  return {
    ...usuarioSeguro,
    configuracion: normalizarConfiguracionUsuario(usuario.configuracion),
  };
}

export async function getUsuarioByEmail(email) {
  const usuario = await collection().findOne({ email });
  if (!usuario) return null;

  return {
    ...usuario,
    configuracion: normalizarConfiguracionUsuario(usuario.configuracion),
  };
}

export async function getUsuarioAuthById(id) {
  const usuario = await collection().findOne({ _id: new ObjectId(id) });
  if (!usuario) return null;

  return {
    ...usuario,
    configuracion: normalizarConfiguracionUsuario(usuario.configuracion),
  };
}

export async function guardarUsuario(usuario) {
  const usuarioAGuardar = { ...usuario };
  if (usuarioAGuardar.password) {
    usuarioAGuardar.password = await bcrypt.hash(usuarioAGuardar.password, 10);
  }
  return collection().insertOne(usuarioAGuardar);
}

export async function eliminarUsuario(id) {
  const usuarioId = new ObjectId(id);
  const usuario = await collection().findOne(
    { _id: usuarioId },
    { projection: { _id: 1 } }
  );

  if (!usuario) {
    return { deletedCount: 0, puntosPropiosEliminados: 0 };
  }

  const puntosResult = await servicePuntos.eliminarPuntosPropiosPorUsuario(id);
  await collection().updateMany(
    {},
    {
      $pull: {
        siguiendo: usuarioId,
        seguidores: usuarioId,
      },
    }
  );
  const usuarioResult = await collection().deleteOne({ _id: usuarioId });

  return {
    ...usuarioResult,
    puntosPropiosEliminados: puntosResult.deletedCount || 0,
  };
}

export async function editarUsuario(id, usuario) {
  return collection().updateOne({ _id: new ObjectId(id) }, { $set: usuario });
}

export async function buscarUsuariosComunidad(filter = {}, idUsuarioActual) {
  const usuarioActual = await collection().findOne({
    _id: new ObjectId(idUsuarioActual),
  });
  if (!usuarioActual) return null;

  const condiciones = [
    { _id: { $ne: new ObjectId(idUsuarioActual) } },
    { "configuracion.perfilPublico": { $ne: false } },
  ];

  if (filter.nombreContiene) {
    const regs = buildFuzzyRegexes(String(filter.nombreContiene));
    condiciones.push({
      $or: regs.map((rx) => ({ nombre: rx })),
    });
  }

  const limit = Math.min(Math.max(Number(filter.limit) || 20, 1), 30);

  const usuarios = await collection()
    .find(
      { $and: condiciones },
      {
        projection: {
          password: 0,
          email: 0,
          role: 0,
        },
      }
    )
    .sort({ nombre: 1, createdAt: -1 })
    .limit(limit)
    .toArray();

  return usuarios.map((usuario) => serializarUsuarioComunidad(usuario, usuarioActual));
}

export async function getComunidadUsuario(idUsuario) {
  const usuario = await collection().findOne({ _id: new ObjectId(idUsuario) });
  if (!usuario) return null;

  const siguiendoIds = normalizarListaIdsUsuarios(usuario.siguiendo || []);
  const seguidoresIds = normalizarListaIdsUsuarios(usuario.seguidores || []);
  const ids = [...new Set([...siguiendoIds, ...seguidoresIds])];
  const usuarios = ids.length
    ? await collection()
        .find(
          { _id: { $in: ids.map((id) => new ObjectId(id)) } },
          {
            projection: {
              password: 0,
              email: 0,
              role: 0,
            },
          }
        )
        .toArray()
    : [];
  const usuariosPorId = new Map(
    usuarios.map((item) => [item._id.toString(), item])
  );

  return {
    seguidoresCount: seguidoresIds.length,
    siguiendoCount: siguiendoIds.length,
    siguiendo: siguiendoIds
      .map((id) => usuariosPorId.get(id))
      .filter(Boolean)
      .map((item) => serializarUsuarioComunidad(item, usuario)),
    seguidores: seguidoresIds
      .map((id) => usuariosPorId.get(id))
      .filter(Boolean)
      .map((item) => serializarUsuarioComunidad(item, usuario)),
  };
}

export async function seguirUsuario(idUsuario, idObjetivo) {
  const usuarioId = new ObjectId(idUsuario);
  const objetivoId = new ObjectId(idObjetivo);

  if (usuarioId.equals(objetivoId)) {
    const error = new Error("No podes seguirte a vos mismo");
    error.status = 400;
    throw error;
  }

  const [usuario, objetivo] = await Promise.all([
    collection().findOne({ _id: usuarioId }),
    collection().findOne({ _id: objetivoId }),
  ]);

  if (!usuario || !objetivo) return null;

  const configObjetivo = normalizarConfiguracionUsuario(objetivo.configuracion);
  if (!configObjetivo.perfilPublico) {
    const error = new Error("Este perfil es privado");
    error.status = 403;
    throw error;
  }

  await Promise.all([
    collection().updateOne(
      { _id: usuarioId },
      { $addToSet: { siguiendo: objetivoId } }
    ),
    collection().updateOne(
      { _id: objetivoId },
      { $addToSet: { seguidores: usuarioId } }
    ),
  ]);

  const usuarioActualizado = await collection().findOne({ _id: usuarioId });
  const objetivoActualizado = await collection().findOne({ _id: objetivoId });
  return serializarUsuarioComunidad(objetivoActualizado, usuarioActualizado);
}

export async function dejarDeSeguirUsuario(idUsuario, idObjetivo) {
  const usuarioId = new ObjectId(idUsuario);
  const objetivoId = new ObjectId(idObjetivo);

  await Promise.all([
    collection().updateOne(
      { _id: usuarioId },
      { $pull: { siguiendo: objetivoId } }
    ),
    collection().updateOne(
      { _id: objetivoId },
      { $pull: { seguidores: usuarioId } }
    ),
  ]);

  const usuarioActualizado = await collection().findOne({ _id: usuarioId });
  const objetivoActualizado = await collection().findOne({ _id: objetivoId });
  if (!objetivoActualizado) return null;
  return serializarUsuarioComunidad(objetivoActualizado, usuarioActualizado);
}

export async function updatePassword(token, password) {
  const secret = process.env.RESET_PASSWORD_SECRET;
  if (!secret) {
    throw new Error("RESET_PASSWORD_SECRET no configurado");
  }

  const payload = jwt.verify(token, secret);
  const email = payload.mail;

  await collection().updateOne(
    { email },
    { $set: { password: await bcrypt.hash(password, 10) } }
  );

  return { message: "OK" };
}

function normalizarIdPunto(valor) {
  if (!valor) return null;
  if (valor instanceof ObjectId) return valor.toString();
  if (typeof valor === "string") return valor;
  if (valor._id instanceof ObjectId) return valor._id.toString();
  if (typeof valor._id === "string") return valor._id;
  return null;
}

function normalizarListaIdsPuntos(lista = []) {
  return lista
    .map(normalizarIdPunto)
    .filter((id) => id && ObjectId.isValid(id));
}

function normalizarRegistroVisita(valor) {
  const id = normalizarIdPunto(
    valor?.idPunto || valor?.punto || valor?.puntoId || valor
  );

  if (!id || !ObjectId.isValid(id)) return null;

  const fecha = valor?.fechaVisita || valor?.visitadoEn || valor?.fecha || valor?.createdAt;
  const fechaVisita = fecha ? new Date(fecha) : new Date();

  return {
    idPunto: new ObjectId(id),
    fechaVisita: Number.isNaN(fechaVisita.getTime()) ? new Date() : fechaVisita,
  };
}

function normalizarListaVisitas(lista = []) {
  const visitasPorId = new Map();

  lista.forEach((valor) => {
    const visita = normalizarRegistroVisita(valor);
    const id = visita?.idPunto?.toString();

    if (id && !visitasPorId.has(id)) {
      visitasPorId.set(id, visita);
    }
  });

  return [...visitasPorId.values()];
}

function normalizarInsignia(valor) {
  const id = normalizarIdPunto(valor?.idPunto || valor?.punto || valor?.puntoId);
  const url = valor?.url || valor?.imagen || valor?.foto;

  if (!id || !ObjectId.isValid(id) || !url) return null;

  return {
    idPunto: new ObjectId(id),
    titulo: valor?.titulo || valor?.nombre || "Insignia",
    url,
    fechaObtencion: valor?.fechaObtencion
      ? new Date(valor.fechaObtencion)
      : new Date(),
  };
}

function normalizarListaInsignias(lista = []) {
  const insigniasPorPunto = new Map();

  lista.forEach((valor) => {
    const insignia = normalizarInsignia(valor);
    const id = insignia?.idPunto?.toString();

    if (id && !insigniasPorPunto.has(id)) {
      insigniasPorPunto.set(id, insignia);
    }
  });

  return [...insigniasPorPunto.values()];
}

export async function agregarFavorito(idUsuario, idPunto) {
  const usuario = await getUsuariosById(idUsuario);
  if (!usuario) return null;

  const favoritos = normalizarListaIdsPuntos(usuario.lugares_favoritos);

  if (!favoritos.includes(idPunto)) {
    favoritos.push(idPunto);
  }

  const favoritosObjectId = favoritos.map((id) => new ObjectId(id));

  await collection().updateOne(
    { _id: new ObjectId(idUsuario) },
    { $set: { lugares_favoritos: favoritosObjectId } }
  );

  return favoritosObjectId;
}

export async function eliminarFavorito(idUsuario, idPunto) {
  const usuario = await getUsuariosById(idUsuario);
  if (!usuario) return null;

  const favoritosObjectId = normalizarListaIdsPuntos(usuario.lugares_favoritos)
    .filter((id) => id !== idPunto)
    .map((id) => new ObjectId(id));

  await collection().updateOne(
    { _id: new ObjectId(idUsuario) },
    { $set: { lugares_favoritos: favoritosObjectId } }
  );

  return favoritosObjectId;
}

export async function borrarHistorialVisitas(idUsuario) {
  const usuario = await getUsuariosById(idUsuario);
  if (!usuario) return null;

  const resultadoVisitas = await serviceVisitas.borrarVisitasUsuario(idUsuario);

  await collection().updateOne(
    { _id: new ObjectId(idUsuario) },
    { $set: { puntos_visitados: [] } }
  );

  return {
    visitasEliminadas: resultadoVisitas.deletedCount || 0,
  };
}

export async function getFavoritosUsuario(idUsuario) {
  const usuario = await getUsuariosById(idUsuario);
  if (!usuario) return null;

  const favoritos = normalizarListaIdsPuntos(usuario.lugares_favoritos);
  if (favoritos.length === 0) return [];

  const objectIds = favoritos.map((id) => new ObjectId(id));
  const puntos = await servicePuntos.getPuntosByIds(objectIds);
  const puntosPorId = new Map(puntos.map((punto) => [punto._id.toString(), punto]));

  return favoritos
    .map((id) => puntosPorId.get(id))
    .filter(Boolean);
}

function getInsigniaUrlPunto(punto = {}) {
  if (typeof punto.insignia === "string") return punto.insignia;
  return punto.insignia?.url || punto.insignia?.imagen || punto.insignia?.foto || "";
}

export async function getAlbumInsigniasUsuario(idUsuario) {
  const usuario = await getUsuariosById(idUsuario);
  if (!usuario) return null;

  const insigniasUsuario = normalizarListaInsignias(usuario.insignias);
  const insigniasPorPunto = new Map(
    insigniasUsuario.map((insignia) => [insignia.idPunto.toString(), insignia])
  );

  const puntosConInsignia = (await servicePuntos.getPuntos())
    .filter((punto) => getInsigniaUrlPunto(punto))
    .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

  const insignias = puntosConInsignia.map((punto) => {
    const idPunto = punto._id.toString();
    const obtenida = insigniasPorPunto.get(idPunto);

    return {
      idPunto,
      nombre: punto.nombre || obtenida?.titulo || "Insignia",
      direccion: punto.direccion || "",
      imagen: getInsigniaUrlPunto(punto) || obtenida?.url || "",
      desbloqueada: Boolean(obtenida),
      fechaObtencion: obtenida?.fechaObtencion || null,
    };
  });

  const desbloqueadas = insignias.filter((insignia) => insignia.desbloqueada).length;

  return {
    usuarioId: idUsuario,
    total: insignias.length,
    desbloqueadas,
    pendientes: Math.max(insignias.length - desbloqueadas, 0),
    insignias,
  };
}

export async function registrarPuntoVisitado(idUsuario, idPunto) {
  const usuario = await getUsuariosById(idUsuario);
  if (!usuario) return null;

  const registro = await serviceVisitas.registrarVisita(idUsuario, idPunto);
  if (!registro.punto) return { usuario, punto: null };

  const visitas = normalizarListaVisitas(usuario.puntos_visitados);
  const yaVisitadoEnUsuario = visitas.some(
    (visita) => visita.idPunto.toString() === idPunto
  );

  if (!yaVisitadoEnUsuario) {
    visitas.push({
      idPunto: new ObjectId(idPunto),
      fechaVisita: new Date(),
    });
  }

  const update = { puntos_visitados: visitas };

  if (registro.punto.insignia) {
    const insignias = normalizarListaInsignias(usuario.insignias);
    const yaTieneInsignia = insignias.some(
      (insignia) => insignia.idPunto.toString() === idPunto
    );

    if (!yaTieneInsignia) {
      insignias.push({
        idPunto: new ObjectId(idPunto),
        titulo: registro.punto.nombre || "Insignia",
        url: registro.punto.insignia,
        fechaObtencion: new Date(),
      });
    }

    update.insignias = insignias;
  }

  await collection().updateOne(
    { _id: new ObjectId(idUsuario) },
    { $set: update }
  );

  return {
    punto: registro.punto,
    yaVisitado: yaVisitadoEnUsuario || !registro.nuevaVisita,
    nuevaVisita: registro.nuevaVisita && !yaVisitadoEnUsuario,
    visitados: visitas,
    totalVisitados: visitas.length,
  };
}

export async function getPuntosVisitadosUsuario(idUsuario) {
  const usuario = await getUsuariosById(idUsuario);
  if (!usuario) return null;

  const visitasRegistradas = await serviceVisitas.getPuntosVisitadosPorUsuario(idUsuario);
  if (visitasRegistradas.length > 0) return visitasRegistradas;

  const visitas = normalizarListaVisitas(usuario.puntos_visitados);
  if (visitas.length === 0) return [];

  const puntos = await servicePuntos.getPuntosByIds(
    visitas.map((visita) => visita.idPunto)
  );
  const puntosPorId = new Map(puntos.map((punto) => [punto._id.toString(), punto]));

  return visitas
    .map((visita) => {
      const punto = puntosPorId.get(visita.idPunto.toString());
      if (!punto) return null;

      return {
        ...punto,
        fechaVisita: visita.fechaVisita,
        visitadoEn: visita.fechaVisita,
      };
    })
    .filter(Boolean)
    .reverse();
}

export async function crearPuntoPropio(idUsuario, punto) {
  const puntoPropio = {
    ...punto,
    creadoPor: new ObjectId(idUsuario),
    origen: "usuario",
    visibilidad: "privado",
    createdAt: new Date(),
  };

  const resultado = await servicePuntos.guardarPunto(puntoPropio);
  return { ...puntoPropio, _id: resultado.insertedId };
}

export async function getPuntosPropios(idUsuario) {
  return servicePuntos.getPuntosPropiosPorUsuario(idUsuario);
}

export async function getPuntoPropioById(idUsuario, idPunto) {
  return servicePuntos.getPuntoPropioById(idUsuario, idPunto);
}

export async function eliminarPuntoPropio(idUsuario, idPunto) {
  return servicePuntos.eliminarPuntoPropio(idUsuario, idPunto);
}

export async function getResumenPuntosPropiosAdmin() {
  const db = getDB();
  const puntos = await db
    .collection("puntos_visitables")
    .find(
      {
        creadoPor: { $exists: true },
        visibilidad: "privado",
      },
      {
        projection: {
          _id: 1,
          nombre: 1,
          creadoPor: 1,
          createdAt: 1,
        },
      }
    )
    .sort({ createdAt: -1, nombre: 1 })
    .toArray();

  const idsUsuarios = [
    ...new Set(
      puntos
        .map((punto) => punto.creadoPor?.toString())
        .filter((id) => id && ObjectId.isValid(id))
    ),
  ];

  const usuarios = idsUsuarios.length
    ? await collection()
        .find(
          { _id: { $in: idsUsuarios.map((id) => new ObjectId(id)) } },
          { projection: { nombre: 1, email: 1 } }
        )
        .toArray()
    : [];

  const usuariosPorId = new Map(
    usuarios.map((usuario) => [usuario._id.toString(), usuario])
  );
  const resumenPorUsuario = new Map();

  puntos.forEach((punto) => {
    const usuarioId = punto.creadoPor?.toString();
    if (!usuarioId || !usuariosPorId.has(usuarioId)) return;

    const usuario = usuariosPorId.get(usuarioId);
    const resumen = resumenPorUsuario.get(usuarioId) || {
      usuarioId,
      usuarioNombre: usuario?.nombre || "Usuario sin nombre",
      usuarioEmail: usuario?.email || "",
      total: 0,
      puntos: [],
    };

    resumen.total += 1;
    resumen.puntos.push({
      id: punto._id.toString(),
      nombre: punto.nombre || "Punto sin nombre",
    });

    resumenPorUsuario.set(usuarioId, resumen);
  });

  return [...resumenPorUsuario.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.usuarioNombre.localeCompare(b.usuarioNombre);
  });
}
