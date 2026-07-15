import { ObjectId } from "mongodb";
import { getDB } from "./db.js";
import * as servicePuntos from "./puntos_visitables.service.js";

function collection() {
  return getDB().collection("visitas");
}

function usuariosCollection() {
  return getDB().collection("usuarios");
}

function normalizarId(valor) {
  if (!valor) return null;
  if (valor instanceof ObjectId) return valor.toString();
  if (typeof valor === "string") return valor;
  if (valor.$oid) return valor.$oid;
  if (valor._id) return normalizarId(valor._id);
  if (valor.idPunto) return normalizarId(valor.idPunto);
  if (valor.punto) return normalizarId(valor.punto);
  if (valor.puntoId) return normalizarId(valor.puntoId);
  return null;
}

function normalizarFecha(valor) {
  const fecha = valor?.fechaVisita || valor?.visitadoEn || valor?.fecha || valor;
  const fechaDate = fecha ? new Date(fecha) : new Date();
  return Number.isNaN(fechaDate.getTime()) ? new Date() : fechaDate;
}

function normalizarVisitasUsuario(lista = []) {
  const visitasPorPunto = new Map();

  lista.forEach((valor) => {
    const id = normalizarId(valor);
    if (!id || !ObjectId.isValid(id) || visitasPorPunto.has(id)) return;

    visitasPorPunto.set(id, {
      idPunto: new ObjectId(id),
      fechaVisita: normalizarFecha(valor),
    });
  });

  return [...visitasPorPunto.values()];
}

function usuarioParticipaEnRanking(usuario) {
  return usuario?.configuracion?.mostrarActividadRanking !== false;
}

export async function asegurarIndiceVisitas() {
  await collection().createIndex(
    { idUsuario: 1, idPunto: 1 },
    { unique: true, name: "usuario_punto_unico" }
  );

  await collection().createIndex(
    { idPunto: 1, fechaVisita: -1 },
    { name: "punto_fecha" }
  );
}

export async function sincronizarVisitasDesdeUsuarios() {
  const usuarios = await usuariosCollection()
    .find(
      { "puntos_visitados.0": { $exists: true } },
      { projection: { _id: 1, puntos_visitados: 1, insignias: 1 } }
    )
    .toArray();

  if (usuarios.length === 0) return { upserted: 0 };

  const operaciones = [];

  usuarios.forEach((usuario) => {
    const insignias = new Set(
      (usuario.insignias || [])
        .map((insignia) => normalizarId(insignia?.idPunto || insignia?.punto || insignia))
        .filter(Boolean)
    );

    normalizarVisitasUsuario(usuario.puntos_visitados).forEach((visita) => {
      operaciones.push({
        updateOne: {
          filter: {
            idUsuario: usuario._id,
            idPunto: visita.idPunto,
          },
          update: {
            $setOnInsert: {
              idUsuario: usuario._id,
              idPunto: visita.idPunto,
              fechaVisita: visita.fechaVisita,
              otorgoInsignia: insignias.has(visita.idPunto.toString()),
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    });
  });

  if (operaciones.length === 0) return { upserted: 0 };

  const resultado = await collection().bulkWrite(operaciones, { ordered: false });
  return { upserted: resultado.upsertedCount || 0 };
}

export async function registrarVisita(idUsuario, idPunto) {
  const punto = await servicePuntos.getPuntosById(idPunto);
  if (!punto) return { punto: null, nuevaVisita: false };

  const ahora = new Date();
  const resultado = await collection().updateOne(
    {
      idUsuario: new ObjectId(idUsuario),
      idPunto: new ObjectId(idPunto),
    },
    {
      $setOnInsert: {
        idUsuario: new ObjectId(idUsuario),
        idPunto: new ObjectId(idPunto),
        fechaVisita: ahora,
        otorgoInsignia: Boolean(punto.insignia),
        createdAt: ahora,
      },
    },
    { upsert: true }
  );

  return {
    punto,
    nuevaVisita: Boolean(resultado.upsertedId),
  };
}

export async function getPuntosVisitadosPorUsuario(idUsuario) {
  const visitas = await collection()
    .find({ idUsuario: new ObjectId(idUsuario) })
    .sort({ fechaVisita: -1 })
    .toArray();

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
    .filter(Boolean);
}

export function puedeAparecerEnRanking(usuario) {
  return usuarioParticipaEnRanking(usuario);
}
