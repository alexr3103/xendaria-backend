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

  return collection().find(filterMongo).toArray();
}

export async function getUsuariosById(id) {
  return collection().findOne({ _id: new ObjectId(id) });
}

export async function getUsuarioByEmail(email) {
  return collection().findOne({ email });
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
  const usuarioResult = await collection().deleteOne({ _id: usuarioId });

  return {
    ...usuarioResult,
    puntosPropiosEliminados: puntosResult.deletedCount || 0,
  };
}

export async function editarUsuario(id, usuario) {
  return collection().updateOne({ _id: new ObjectId(id) }, { $set: usuario });
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
