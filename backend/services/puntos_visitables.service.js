import { ObjectId } from "mongodb";
import { getDB } from "./db.js";

// Acceso directo a la colección
function collection() {
  const db = getDB();
  return db.collection("puntos_visitables");
}

function _escapeRegex(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function _expandDiacritics(s = "") {
  const map = {
    a: "[aáàäâãå]", A: "[AÁÀÄÂÃÅ]",
    e: "[eéèëê]",   E: "[EÉÈËÊ]",
    i: "[iíìïî]",   I: "[IÍÌÏÎ]",
    o: "[oóòöôõ]",  O: "[OÓÒÖÔÕ]",
    u: "[uúùüû]",   U: "[UÚÙÜÛ]",
    n: "[nñ]",      N: "[NÑ]",
    c: "[cç]",      C: "[CÇ]",
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
    const after  = _expandDiacritics(t.slice(i + 1));
    regs.push(new RegExp(before + "." + after, "i"));
  }
  for (let i = 0; i < t.length; i++) {
    const omit = _expandDiacritics(t.slice(0, i) + t.slice(i + 1));
    regs.push(new RegExp(omit, "i"));
  }
  regs.push(new RegExp("^" + base, "i"));
  return regs;
}

//servicios principales
export async function getPuntos(filter = {}) {
  const filterMongo = {};
  if (filter.categoria && filter.categoria !== "Todos") {
    filterMongo.categoria = String(filter.categoria);
  }
  if (filter.nombreContiene && String(filter.nombreContiene).trim() !== "") {
    const regs = buildFuzzyRegexes(String(filter.nombreContiene));
    filterMongo.$or = regs.map(rx => ({ nombre: rx }));
  }
  return collection().find(filterMongo).toArray();
}

export async function getPuntosById(id) {
  return collection().findOne({ _id: new ObjectId(id) });
}

export async function guardarPunto(punto) {
  return collection().insertOne(punto);
}

export async function reemplazarPunto(id, punto) {
  return collection().replaceOne({ _id: new ObjectId(id) }, punto);
}

export async function eliminarPunto(id) {
  return collection().deleteOne({ _id: new ObjectId(id) });
}

export async function editarPunto(id, punto) {
  return collection().updateOne({ _id: new ObjectId(id) }, { $set: punto });
}