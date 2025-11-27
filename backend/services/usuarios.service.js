import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import * as servicePuntos from "./puntos_visitables.service.js";
import jwt from "jsonwebtoken";
import { getDB } from "./db.js";

// -------------------------------
// UTILS PARA BUSQUEDAS FLEXIBLES
// -------------------------------
function _escapeRegex(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _expandDiacritics(s = "") {
  const map = {
    a: "[aáàäâãå]", A: "[AÁÀÄÂÃÅ]",
    e: "[eéèëê]", E: "[EÉÈËÊ]",
    i: "[iíìïî]", I: "[IÍÌÏÎ]",
    o: "[oóòöôõ]", O: "[OÓÒÖÔÕ]",
    u: "[uúùüû]", U: "[UÚÙÜÛ]",
    n: "[nñ]", N: "[NÑ]",
    c: "[cç]", C: "[CÇ]"
  };
  const esc = _escapeRegex(s);
  return esc.replace(/[aeiouncAEIOUNC]/g, ch => map[ch] || ch);
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

// ----------------------------------
// GET TODOS LOS USUARIOS CON FILTROS
// ----------------------------------
export async function getUsuarios(filter = {}) {
  const db = getDB();
  const collection = db.collection("usuarios");

  const filterMongo = {};

  if (filter.filtro === "Con favoritos") {
    filterMongo["lugares_favoritos.0"] = { $exists: true };
  } else if (filter.filtro === "Sin favoritos") {
    filterMongo.$or = [
      { lugares_favoritos: { $exists: false } },
      { "lugares_favoritos.0": { $exists: false } }
    ];
  }

  if (filter.nombreContiene) {
    const regs = buildFuzzyRegexes(String(filter.nombreContiene));
    filterMongo.$or = [...(filterMongo.$or || []), ...regs.map(rx => ({ nombre: rx }))];
  }

  return collection.find(filterMongo).toArray();
}

// ----------------------------------
// GET USUARIO POR ID
// ----------------------------------
export async function getUsuariosById(id) {
  const db = getDB();
  return db.collection("usuarios").findOne({ _id: new ObjectId(id) });
}

// ----------------------------------
// CREAR NUEVO USUARIO
// ----------------------------------
export async function crearUsuario(usuario) {
  const db = getDB();
  const collection = db.collection("usuarios");

  const existe = await collection.findOne({ email: usuario.email });
  if (existe) throw new Error("El email ya está registrado");

  usuario.password = await bcrypt.hash(usuario.password, 10);

  const { insertedId } = await collection.insertOne(usuario);
  return { ...usuario, _id: insertedId };
}

// ----------------------------------
// LOGIN NORMAL
// ----------------------------------
export async function loginUsuario(email, password) {
  const db = getDB();
  const collection = db.collection("usuarios");

  const usuario = await collection.findOne({ email });
  if (!usuario)
    return { ok: false, status: 404, msg: "Usuario no encontrado" };

  const valido = await bcrypt.compare(password.trim(), usuario.password.trim());
  if (!valido)
    return { ok: false, status: 401, msg: "Contraseña incorrecta" };

  return { ok: true, data: usuario };
}

// ----------------------------------
// ELIMINAR USUARIO
// ----------------------------------
export async function eliminarUsuario(id) {
  const db = getDB();
  return db.collection("usuarios").deleteOne({ _id: new ObjectId(id) });
}

// ----------------------------------
// EDITAR USUARIO
// ----------------------------------
export async function editarUsuario(id, usuario) {
  const db = getDB();
  const col = db.collection("usuarios");

  if (usuario.password) {
    usuario.password = await bcrypt.hash(usuario.password, 10);
  }

  return col.updateOne({ _id: new ObjectId(id) }, { $set: usuario });
}

// ----------------------------------
// RESET PASSWORD POR TOKEN
// ----------------------------------
export async function updatePassword(token, password) {
  const db = getDB();
  const email = jwt.verify(token, "RECUPERAR").mail;

  return db.collection("usuarios").updateOne(
    { email },
    { $set: { password: await bcrypt.hash(password, 10) } }
  );
}

// ----------------------------------
// GUARDAR PUNTO (FAVORITO O NUEVO)
// ----------------------------------
export async function guardarDuenio(idUsuario, punto, crearNuevo = true) {
  const db = getDB();
  const col = db.collection("usuarios");

  let puntoFinal;

  if (crearNuevo) {
    const resultado = await servicePuntos.guardarPunto(punto);
    puntoFinal = { ...punto, _id: resultado.insertedId };
  } else {
    puntoFinal = punto;
  }

  // Si no tiene favoritos aún, crear array vacío
  await col.updateOne(
    { _id: new ObjectId(idUsuario) },
    { $setOnInsert: { lugares_favoritos: [] } },
    { upsert: true }
  );

  // Agregar sin duplicar
  await col.updateOne(
    { _id: new ObjectId(idUsuario) },
    { $addToSet: { lugares_favoritos: puntoFinal } }
  );

  return puntoFinal;
}

// ----------------------------------
// OBTENER FAVORITOS
// ----------------------------------
export async function getPuntoUsuario(id) {
  const usuario = await getUsuariosById(id);
  return usuario ? usuario.lugares_favoritos || [] : null;
}
