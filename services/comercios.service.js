import { ObjectId } from "mongodb";
import { getDB } from "./db.js";

const PLANES = new Set(["1 mes", "3 meses", "6 meses"]);
const TIPOS_BENEFICIO = new Set([
  "descuento",
  "cortesia",
  "primera_visita",
  "ruta",
  "otro",
]);
const ESTADOS = new Set(["pendiente", "contactado", "aprobado", "rechazado"]);

function collection() {
  return getDB().collection("solicitudes_comercio");
}

function errorValidacion(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizarTexto(value, campo, { requerido = false, max = 250 } = {}) {
  const texto = String(value || "").trim();

  if (requerido && !texto) {
    throw errorValidacion(`El campo ${campo} es obligatorio`);
  }

  if (texto.length > max) {
    throw errorValidacion(`El campo ${campo} supera el máximo de ${max} caracteres`);
  }

  return texto;
}

function normalizarSolicitud(data = {}) {
  const plan = normalizarTexto(data.plan, "plan", { requerido: true, max: 20 });
  const tipoBeneficio = normalizarTexto(data.tipoBeneficio, "tipo de beneficio", {
    requerido: true,
    max: 40,
  });
  const email = normalizarTexto(data.email, "email", {
    requerido: true,
    max: 160,
  }).toLowerCase();
  const telefono = normalizarTexto(data.telefono, "teléfono", {
    requerido: true,
    max: 24,
  });
  const historia = normalizarTexto(data.historia, "historia o leyenda", {
    max: 1200,
  });
  const quiereInsignia =
    data.quiereInsignia === true || data.quiereInsignia === "si";
  const asociarHistoriaInsignia =
    quiereInsignia &&
    (data.asociarHistoriaInsignia === true ||
      data.asociarHistoriaInsignia === "true");

  if (!PLANES.has(plan)) {
    throw errorValidacion("El plan seleccionado no es válido");
  }

  if (!TIPOS_BENEFICIO.has(tipoBeneficio)) {
    throw errorValidacion("El tipo de beneficio seleccionado no es válido");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw errorValidacion("Ingresá un email válido");
  }

  const cantidadDigitos = telefono.replace(/\D/g, "").length;
  if (cantidadDigitos < 8 || cantidadDigitos > 15) {
    throw errorValidacion("Ingresá un teléfono válido de entre 8 y 15 números");
  }

  if (asociarHistoriaInsignia && !historia) {
    throw errorValidacion(
      "Escribí la historia o leyenda que querés asociar a la insignia"
    );
  }

  return {
    plan,
    nombreComercio: normalizarTexto(data.nombreComercio, "nombre del comercio", {
      requerido: true,
      max: 120,
    }),
    rubro: normalizarTexto(data.rubro, "rubro", {
      requerido: true,
      max: 80,
    }),
    direccion: normalizarTexto(data.direccion, "dirección", {
      requerido: true,
      max: 220,
    }),
    email,
    telefono,
    redes: normalizarTexto(data.redes, "Instagram o sitio web", { max: 240 }),
    tipoBeneficio,
    beneficio: normalizarTexto(data.beneficio, "detalle del beneficio", {
      requerido: true,
      max: 180,
    }),
    historia,
    quiereInsignia,
    asociarHistoriaInsignia,
  };
}

export async function asegurarIndicesComercios() {
  await collection().createIndex({ estado: 1, createdAt: -1 });
  await collection().createIndex({ email: 1, createdAt: -1 });
}

export async function crearSolicitudComercio(data) {
  const solicitud = normalizarSolicitud(data);
  const ahora = new Date();

  const documento = {
    ...solicitud,
    estado: "pendiente",
    emailAdminEnviado: false,
    emailComercioEnviado: false,
    createdAt: ahora,
    updatedAt: ahora,
  };

  const resultado = await collection().insertOne(documento);
  return { ...documento, _id: resultado.insertedId };
}

export async function actualizarEstadoEmails(
  idSolicitud,
  { emailAdminEnviado, emailComercioEnviado }
) {
  await collection().updateOne(
    { _id: new ObjectId(idSolicitud) },
    {
      $set: {
        emailAdminEnviado: Boolean(emailAdminEnviado),
        emailComercioEnviado: Boolean(emailComercioEnviado),
        updatedAt: new Date(),
      },
    }
  );
}

export async function getSolicitudesComercio({ estado } = {}) {
  const filtro = estado && ESTADOS.has(estado) ? { estado } : {};
  return collection().find(filtro).sort({ createdAt: -1 }).toArray();
}

export async function actualizarEstadoSolicitud(idSolicitud, estado) {
  if (!ESTADOS.has(estado)) {
    throw errorValidacion("El estado seleccionado no es válido");
  }

  const resultado = await collection().findOneAndUpdate(
    { _id: new ObjectId(idSolicitud) },
    {
      $set: {
        estado,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return resultado;
}
