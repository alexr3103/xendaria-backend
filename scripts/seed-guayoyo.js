import dotenv from "dotenv";

import { closeDB, connectDB, getDB } from "../services/db.js";
import {
  editarPunto,
  guardarPunto,
} from "../services/puntos_visitables.service.js";
import {
  asegurarIndicesRecompensasComercio,
  guardarConfiguracionRecompensa,
} from "../services/recompensas_comercio.service.js";

dotenv.config();

const puntoGuayoyo = {
  nombre: "Guayoyo",
  categoria: "comercios",
  categorias: ["comercios"],
  direccion: "Ciudad de la Paz 3419, Núñez, Buenos Aires, C1429, Argentina",
  descripcion: "Un rincón para disfrutar café y sabores venezolanos en Núñez.",
  descripcion_completa:
    "Guayoyo se suma a Xendaria como comercio de prueba con un beneficio especial para la primera visita.",
  lat: -34.551328,
  lon: -58.467963,
  ubicacion: {
    type: "Point",
    coordinates: [-58.467963, -34.551328],
  },
  foto: "",
  fotos: [],
  insignia: null,
  historias: [],
  multimedia: [],
  activo: true,
};

async function ejecutar() {
  await connectDB();
  await asegurarIndicesRecompensasComercio();

  const collection = getDB().collection("puntos_visitables");
  let punto = await collection.findOne({
    nombre: { $regex: "^Guayoyo$", $options: "i" },
  });

  if (punto) {
    await editarPunto(punto._id, puntoGuayoyo);
  } else {
    const resultado = await guardarPunto(puntoGuayoyo);
    punto = { _id: resultado.insertedId };
  }

  await guardarConfiguracionRecompensa(punto._id, {
    beneficio: "10% de descuento en tu primera compra",
    codigo: "GUAYOYO10",
    venceEn: "2026-12-31",
    activa: true,
  });

  console.log(
    JSON.stringify({
      ok: true,
      idPunto: punto._id.toString(),
      nombre: puntoGuayoyo.nombre,
      vencimiento: "2026-12-31",
    })
  );
}

ejecutar()
  .catch((error) => {
    console.error("[seed-guayoyo]", error);
    process.exitCode = 1;
  })
  .finally(closeDB);
