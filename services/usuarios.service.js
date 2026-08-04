import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getDB } from "./db.js";
import * as servicePuntos from "./puntos_visitables.service.js";
import * as serviceVisitas from "./visitas.service.js";
import * as notificacionesService from "./notificaciones.service.js";

const REGEX_SPECIAL_CHARACTERS_REGEX = /[.*+?^${}()|[\]\\]/g;
const DIACRITIC_LETTERS_REGEX = /[aeiouncAEIOUNC]/g;
const ADMIN_ROLE_REGEX = /^admin$/i;

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
    rutas: false,
    compras: false,
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
  return String(s).replace(REGEX_SPECIAL_CHARACTERS_REGEX, "\\$&");
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
  return esc.replace(DIACRITIC_LETTERS_REGEX, (ch) => map[ch] || ch);
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

async function getIdsAdministradores() {
  const administradores = await collection()
    .find(
      { role: ADMIN_ROLE_REGEX },
      { projection: { _id: 1 } }
    )
    .toArray();

  return new Set(administradores.map((usuario) => usuario._id.toString()));
}

function filtrarIdsAdministradores(lista = [], idsAdministradores = new Set()) {
  return normalizarListaIdsUsuarios(lista).filter(
    (id) => !idsAdministradores.has(id)
  );
}

function serializarUsuarioComunidad(
  usuario,
  usuarioActual = null,
  idsAdministradores = new Set()
) {
  const config = normalizarConfiguracionUsuario(usuario.configuracion);
  const siguiendoActual = new Set(
    filtrarIdsAdministradores(
      usuarioActual?.siguiendo || [],
      idsAdministradores
    )
  );
  const seguidoresActual = new Set(
    filtrarIdsAdministradores(
      usuarioActual?.seguidores || [],
      idsAdministradores
    )
  );
  const id = usuario._id.toString();

  return {
    _id: id,
    nombre: usuario.nombre || "Usuario",
    foto: usuario.foto || "",
    descripcion: config.perfilPublico ? usuario.descripcion || "" : "",
    perfilPublico: config.perfilPublico,
    seguidoresCount: filtrarIdsAdministradores(
      usuario.seguidores || [],
      idsAdministradores
    ).length,
    siguiendoCount: filtrarIdsAdministradores(
      usuario.siguiendo || [],
      idsAdministradores
    ).length,
    loSigo: siguiendoActual.has(id),
    meSigue: seguidoresActual.has(id),
  };
}

export async function getUsuarios(filter = {}) {
  const condiciones = [{ role: { $not: ADMIN_ROLE_REGEX } }];

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

export async function desactivarUsuario(id) {
  const usuarioId = new ObjectId(id);
  const usuario = await collection().findOne(
    { _id: usuarioId },
    { projection: { _id: 1, role: 1 } }
  );

  if (!usuario) return { matchedCount: 0, modifiedCount: 0 };

  return collection().updateOne(
    { _id: usuarioId },
    {
      $set: {
        activo: false,
        desactivadoEn: new Date(),
      },
    }
  );
}

export async function reactivarUsuario(id) {
  return collection().updateOne(
    {
      _id: new ObjectId(id),
      role: { $not: ADMIN_ROLE_REGEX },
      activo: false,
    },
    {
      $set: {
        activo: true,
        reactivadoEn: new Date(),
      },
      $unset: {
        desactivadoEn: "",
      },
    }
  );
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
  await notificacionesService.eliminarDatosNotificacionesUsuario(id);
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
  const [usuarioActual, idsAdministradores] = await Promise.all([
    collection().findOne({
      _id: new ObjectId(idUsuarioActual),
    }),
    getIdsAdministradores(),
  ]);
  if (!usuarioActual) return null;

  const condiciones = [
    { _id: { $ne: new ObjectId(idUsuarioActual) } },
    { role: { $not: ADMIN_ROLE_REGEX } },
    { activo: { $ne: false } },
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

  return usuarios.map((usuario) =>
    serializarUsuarioComunidad(usuario, usuarioActual, idsAdministradores)
  );
}

export async function getComunidadUsuario(idUsuario) {
  const [usuario, idsAdministradores] = await Promise.all([
    collection().findOne({ _id: new ObjectId(idUsuario) }),
    getIdsAdministradores(),
  ]);
  if (!usuario) return null;

  const siguiendoIds = filtrarIdsAdministradores(
    usuario.siguiendo || [],
    idsAdministradores
  );
  const seguidoresIds = filtrarIdsAdministradores(
    usuario.seguidores || [],
    idsAdministradores
  );
  const ids = [...new Set([...siguiendoIds, ...seguidoresIds])];
  const usuarios = ids.length
    ? await collection()
        .find(
          {
            _id: { $in: ids.map((id) => new ObjectId(id)) },
            role: { $not: ADMIN_ROLE_REGEX },
            activo: { $ne: false },
          },
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
      .map((item) =>
        serializarUsuarioComunidad(item, usuario, idsAdministradores)
      ),
    seguidores: seguidoresIds
      .map((id) => usuariosPorId.get(id))
      .filter(Boolean)
      .map((item) =>
        serializarUsuarioComunidad(item, usuario, idsAdministradores)
      ),
  };
}

export async function seguirUsuario(idUsuario, idObjetivo) {
  const usuarioId = new ObjectId(idUsuario);
  const objetivoId = new ObjectId(idObjetivo);

  if (usuarioId.equals(objetivoId)) {
    const error = new Error("No podés seguirte a vos mismo");
    error.status = 400;
    throw error;
  }

  const [usuario, objetivo] = await Promise.all([
    collection().findOne({ _id: usuarioId }),
    collection().findOne({ _id: objetivoId }),
  ]);

  if (!usuario || !objetivo) return null;

  if (
    String(usuario.role || "").toLowerCase() === "admin" ||
    String(objetivo.role || "").toLowerCase() === "admin" ||
    objetivo.activo === false
  ) {
    const error = new Error("Usuario no encontrado");
    error.status = 404;
    throw error;
  }

  const configObjetivo = normalizarConfiguracionUsuario(objetivo.configuracion);
  if (!configObjetivo.perfilPublico) {
    const error = new Error("Este perfil es privado");
    error.status = 403;
    throw error;
  }

  const [resultadoSiguiendo] = await Promise.all([
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

  if (resultadoSiguiendo.modifiedCount > 0) {
    try {
      await notificacionesService.crearNotificacionUsuario({
        idUsuario: objetivoId,
        tipo: "seguidor",
        titulo: "Nuevo seguidor",
        mensaje: `${usuarioActualizado.nombre || "Una persona"} empezó a seguirte.`,
        enlace: `/perfil/${usuarioId.toString()}`,
        metadata: {
          idSeguidor: usuarioId.toString(),
        },
      });
    } catch (error) {
      console.error("[notificarNuevoSeguidor]", error);
    }
  }

  const idsAdministradores = await getIdsAdministradores();
  return serializarUsuarioComunidad(
    objetivoActualizado,
    usuarioActualizado,
    idsAdministradores
  );
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
  const idsAdministradores = await getIdsAdministradores();
  return serializarUsuarioComunidad(
    objetivoActualizado,
    usuarioActualizado,
    idsAdministradores
  );
}

export async function ocultarRelacionesAdministradores(usuario) {
  if (!usuario) return null;

  const idsAdministradores = await getIdsAdministradores();
  return {
    ...usuario,
    siguiendo: filtrarIdsAdministradores(
      usuario.siguiendo || [],
      idsAdministradores
    ),
    seguidores: filtrarIdsAdministradores(
      usuario.seguidores || [],
      idsAdministradores
    ),
  };
}

export async function quitarUsuarioDeComunidad(idUsuario) {
  const usuarioId = new ObjectId(idUsuario);

  await Promise.all([
    collection().updateMany(
      {},
      {
        $pull: {
          siguiendo: usuarioId,
          seguidores: usuarioId,
        },
      }
    ),
    collection().updateOne(
      { _id: usuarioId },
      {
        $set: {
          siguiendo: [],
          seguidores: [],
        },
      }
    ),
  ]);
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
    direccion: valor?.direccion || "",
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

export async function hidratarInsigniasUsuario(usuario) {
  if (!usuario) return null;

  const insignias = normalizarListaInsignias(usuario.insignias);
  if (insignias.length === 0) {
    return { ...usuario, insignias: [] };
  }

  const puntos = await servicePuntos.getPuntosByIds(
    insignias.map((insignia) => insignia.idPunto)
  );
  const puntosPorId = new Map(
    puntos.map((punto) => [punto._id.toString(), punto])
  );

  return {
    ...usuario,
    insignias: insignias.map((insignia) => {
      const punto = puntosPorId.get(insignia.idPunto.toString());
      const imagenActual = punto ? getInsigniaUrlPunto(punto) : "";

      if (!imagenActual) return insignia;

      return {
        ...insignia,
        titulo: punto.nombre || insignia.titulo,
        direccion: punto.direccion || insignia.direccion,
        url: imagenActual,
      };
    }),
  };
}

export async function getAlbumInsigniasUsuario(idUsuario) {
  const usuario = await getUsuariosById(idUsuario);
  if (!usuario) return null;

  const insigniasUsuario = normalizarListaInsignias(usuario.insignias);
  const insigniasPorPunto = new Map(
    insigniasUsuario.map((insignia) => [insignia.idPunto.toString(), insignia])
  );

  const puntosConInsignia = (
    await servicePuntos.getPuntos({ incluirInactivos: true })
  )
    .filter((punto) => getInsigniaUrlPunto(punto))
    .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

  const idsPuntosAlbum = new Set(
    puntosConInsignia.map((punto) => punto._id.toString())
  );
  const insigniasArchivadas = (await servicePuntos.getInsigniasArchivadas())
    .filter((insignia) => insignia.imagen)
    .filter((insignia) => !idsPuntosAlbum.has(insignia._id.toString()));
  const idsInsigniasArchivadas = new Set(
    insigniasArchivadas.map((insignia) => insignia._id.toString())
  );
  const insigniasPuntos = puntosConInsignia.map((punto) => {
    const idPunto = punto._id.toString();
    const obtenida = insigniasPorPunto.get(idPunto);

    return {
      idPunto,
      nombre: punto.nombre || obtenida?.titulo || "Insignia",
      direccion: punto.direccion || "",
      imagen: getInsigniaUrlPunto(punto) || obtenida?.url || "",
      desbloqueada: Boolean(obtenida),
      fechaObtencion: obtenida?.fechaObtencion || null,
      disponible: punto.activo !== false,
    };
  });
  const insigniasEliminadas = insigniasArchivadas.map((insignia) => {
    const idPunto = insignia._id.toString();
    const obtenida = insigniasPorPunto.get(idPunto);

    return {
      idPunto,
      nombre: insignia.nombre || obtenida?.titulo || "Insignia",
      direccion: insignia.direccion || obtenida?.direccion || "",
      imagen: insignia.imagen || obtenida?.url || "",
      desbloqueada: Boolean(obtenida),
      fechaObtencion: obtenida?.fechaObtencion || null,
      disponible: false,
    };
  });
  const insigniasHistoricas = insigniasUsuario
    .filter(
      (insignia) =>
        !idsPuntosAlbum.has(insignia.idPunto.toString()) &&
        !idsInsigniasArchivadas.has(insignia.idPunto.toString())
    )
    .map((insignia) => ({
      idPunto: insignia.idPunto.toString(),
      nombre: insignia.titulo || "Insignia",
      direccion: insignia.direccion || "",
      imagen: insignia.url || "",
      desbloqueada: true,
      fechaObtencion: insignia.fechaObtencion || null,
      disponible: false,
    }));
  const insignias = [
    ...insigniasPuntos,
    ...insigniasEliminadas,
    ...insigniasHistoricas,
  ].sort((a, b) =>
    String(a.nombre || "").localeCompare(String(b.nombre || ""))
  );

  const desbloqueadas = insignias.filter((insignia) => insignia.desbloqueada).length;
  const totalContabilizable = insignias.filter(
    (insignia) => insignia.disponible || insignia.desbloqueada
  ).length;

  return {
    usuarioId: idUsuario,
    total: totalContabilizable,
    desbloqueadas,
    pendientes: Math.max(totalContabilizable - desbloqueadas, 0),
    noDisponibles: insignias.filter((insignia) => !insignia.disponible).length,
    insignias,
  };
}

export async function registrarPuntoVisitado(
  idUsuario,
  idPunto,
  ubicacionActual
) {
  const usuario = await getUsuariosById(idUsuario);
  if (!usuario) return null;

  const registro = await serviceVisitas.registrarVisita(
    idUsuario,
    idPunto,
    ubicacionActual
  );
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
        direccion: registro.punto.direccion || "",
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
    distanciaMetros: registro.distanciaMetros,
    radioPermitidoMetros: registro.radioPermitidoMetros,
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
