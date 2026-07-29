import dotenv from "dotenv";
import { ObjectId } from "mongodb";

import { closeDB, connectDB, getDB } from "../services/db.js";
import {
  asegurarIndicesRecompensasComercio,
  canjearRecompensa,
  getCanjesRecompensasUsuario,
  getEstadoRecompensaUsuario,
} from "../services/recompensas_comercio.service.js";

dotenv.config();

const idUsuarioTemporal = new ObjectId();
let idPunto;

async function ejecutar() {
  await connectDB();
  await asegurarIndicesRecompensasComercio();

  const db = getDB();
  const punto = await db
    .collection("puntos_visitables")
    .findOne({ nombre: "Guayoyo" });

  if (!punto) throw new Error("Guayoyo no existe");
  idPunto = punto._id;

  const estadoInicial = await getEstadoRecompensaUsuario(
    idUsuarioTemporal,
    idPunto
  );

  await db.collection("visitas").insertOne({
    idUsuario: idUsuarioTemporal,
    idPunto,
    fechaVisita: new Date(),
    createdAt: new Date(),
  });

  const estadoDisponible = await getEstadoRecompensaUsuario(
    idUsuarioTemporal,
    idPunto
  );
  const primerCanje = await canjearRecompensa(idUsuarioTemporal, idPunto);
  const historial = await getCanjesRecompensasUsuario(idUsuarioTemporal);

  let segundoCanjeBloqueado = false;
  try {
    await canjearRecompensa(idUsuarioTemporal, idPunto);
  } catch (error) {
    segundoCanjeBloqueado = error.status === 409;
  }

  const estadoFinal = await getEstadoRecompensaUsuario(
    idUsuarioTemporal,
    idPunto
  );

  console.log(
    JSON.stringify({
      estadoInicial: estadoInicial.estado,
      estadoDisponible: estadoDisponible.estado,
      primerCanjeEntregoCodigo: Boolean(primerCanje.codigo),
      historialRegistroElCanje:
        historial.length === 1 && historial[0].nombrePunto === punto.nombre,
      historialExponeCodigo: historial.some((canje) =>
        Object.hasOwn(canje, "codigo")
      ),
      segundoCanjeBloqueado,
      estadoFinal: estadoFinal.estado,
      estadoFinalExponeCodigo: Object.hasOwn(estadoFinal, "codigo"),
    })
  );
}

ejecutar()
  .catch((error) => {
    console.error("[verificar-recompensa-comercio]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (idPunto) {
      const db = getDB();
      await Promise.all([
        db.collection("visitas").deleteOne({
          idUsuario: idUsuarioTemporal,
          idPunto,
        }),
        db.collection("canjes_recompensas_comercio").deleteOne({
          idUsuario: idUsuarioTemporal,
          idPunto,
        }),
      ]);
    }
    await closeDB();
  });
