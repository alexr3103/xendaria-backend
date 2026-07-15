import { ObjectId } from "mongodb";
import { getDB } from "./db.js";
import * as carritoService from "./carrito.service.js";
import * as emailService from "./email.service.js";
import * as usuariosService from "./usuarios.service.js";
import * as mercadopagoService from "./mercadopago.service.js";
import * as enviosService from "./envios.service.js";

function collection() {
  const db = getDB();
  return db.collection("ordenes");
}

const ESTADOS_PAGO_CONFIRMADO = new Set(["pagada", "procesando", "enviada"]);
const ESTADOS_ORDEN_ADMIN = new Set([
  "pagada",
  "procesando",
  "enviada",
]);
const ESTADOS_ORDEN_VISIBLES = ["pagada", "procesando", "enviada"];

function mismaVariante(varianteA, varianteB) {
  const colorA = varianteA?.color || null;
  const colorB = varianteB?.color || null;
  const talleA = varianteA?.talle || null;
  const talleB = varianteB?.talle || null;
  const disenoA = varianteA?.diseno || null;
  const disenoB = varianteB?.diseno || null;

  return (
    colorA === colorB &&
    talleA === talleB &&
    disenoA === disenoB
  );
}

async function generarNumeroCompra() {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");

  const prefijoMes = `${anio}${mes}`;

  const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1, 0, 0, 0, 0);
  const finMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59, 999);

  const cantidadMes = await collection().countDocuments({
    createdAt: {
      $gte: inicioMes,
      $lte: finMes,
    },
  });

  const numero = String(cantidadMes + 1).padStart(4, "0");

  return `XEN-${prefijoMes}-${numero}`;
}

async function descontarStockDeOrden(orden) {
  const productosCollection = getDB().collection("productos_merch");

  for (const item of orden.items) {
    const productoId = new ObjectId(item.idProducto);
    const producto = await productosCollection.findOne({ _id: productoId });

    if (!producto) {
      throw new Error(`No se encontro el producto ${item.idProducto} para descontar stock`);
    }

    const stockGeneralActual = producto.stock ?? 0;

    if (stockGeneralActual < item.cantidad) {
      throw new Error(`Stock no disponible para ${producto.nombre}`);
    }

    if (item.variante && Array.isArray(producto.variantes) && producto.variantes.length) {
      const indiceVariante = producto.variantes.findIndex((variante) =>
        mismaVariante(variante, item.variante)
      );

      if (indiceVariante === -1) {
        throw new Error(`No se encontro la variante vendida para ${producto.nombre}`);
      }

      const variantesActualizadas = [...producto.variantes];
      const stockVarianteActual = variantesActualizadas[indiceVariante].stock ?? 0;

      if (stockVarianteActual < item.cantidad) {
        throw new Error(`Stock no disponible para la variante de ${producto.nombre}`);
      }

      variantesActualizadas[indiceVariante] = {
        ...variantesActualizadas[indiceVariante],
        stock: stockVarianteActual - item.cantidad,
      };

      await productosCollection.updateOne(
        { _id: productoId },
        {
          $set: {
            stock: stockGeneralActual - item.cantidad,
            variantes: variantesActualizadas,
          },
        }
      );

      continue;
    }

    await productosCollection.updateOne(
      { _id: productoId },
      {
        $set: {
          stock: stockGeneralActual - item.cantidad,
        },
      }
    );
  }
}

function normalizarItemsParaCheckout(items) {
  return items.map((item) => ({
    idProducto: item.idProducto?.toString?.() || item.idProducto,
    nombre: item.nombre,
    imagen: item.imagen || "",
    precioUnitario: item.precioUnitario,
    cantidad: item.cantidad,
    subtotal: item.subtotal,
    variante: item.variante || null,
  }));
}

function obtenerCheckoutDesdePago(pago) {
  const metadata = pago.metadata || {};
  const raw =
    metadata.checkout ||
    metadata.checkout_data ||
    metadata.checkoutJson ||
    metadata.checkout_json;

  if (!raw) {
    return null;
  }

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (typeof raw === "object") {
    return raw;
  }

  return null;
}

export async function getOrdenes() {
  const ordenes = await collection()
    .find({ estado: { $in: ESTADOS_ORDEN_VISIBLES } })
    .sort({ createdAt: -1 })
    .toArray();
  const idsUsuarios = [
    ...new Set(
      ordenes
        .map((orden) => orden.idUsuario?.toString())
        .filter((id) => id && ObjectId.isValid(id))
    ),
  ];

  const usuarios = idsUsuarios.length
    ? await getDB()
        .collection("usuarios")
        .find(
          { _id: { $in: idsUsuarios.map((id) => new ObjectId(id)) } },
          { projection: { nombre: 1, email: 1 } }
        )
        .toArray()
    : [];

  const usuariosPorId = new Map(
    usuarios.map((usuario) => [usuario._id.toString(), usuario])
  );

  return ordenes.map((orden) => {
    const usuario = usuariosPorId.get(orden.idUsuario?.toString());

    return {
      ...orden,
      usuario: usuario
        ? {
            _id: usuario._id,
            nombre: usuario.nombre || "Usuario sin nombre",
            email: usuario.email || "",
          }
        : {
            _id: orden.idUsuario,
            nombre: "Usuario eliminado",
            email: "",
          },
    };
  });
}

export async function getOrdenesByUsuario(idUsuario) {
  return collection()
    .find({
      idUsuario: new ObjectId(idUsuario),
      estado: { $in: ESTADOS_ORDEN_VISIBLES },
    })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getOrdenById(id) {
  return collection().findOne({ _id: new ObjectId(id) });
}

export async function actualizarEstadoOrden(idOrden, estado) {
  if (!ESTADOS_ORDEN_ADMIN.has(estado)) {
    const error = new Error("Estado de orden invalido");
    error.statusCode = 400;
    throw error;
  }

  const set = {
    estado,
    updatedAt: new Date(),
  };

  if (estado === "procesando") {
    set.procesandoAt = new Date();
  }

  if (estado === "enviada") {
    set.enviadaAt = new Date();
  }

  const resultado = await collection().updateOne(
    { _id: new ObjectId(idOrden) },
    { $set: set }
  );

  if (!resultado.matchedCount) {
    return null;
  }

  return getOrdenById(idOrden);
}

export async function crearPreferenciaMercadoPagoDesdeCarrito(idUsuario, datosEnvio) {
  const carrito = await carritoService.getCarritoByUsuario(idUsuario);

  if (!carrito || !carrito.items.length) {
    return null;
  }

  const subtotal = carrito.items.reduce((acc, item) => acc + item.subtotal, 0);
  const descuento = 0;
  const costoEnvio = await enviosService.calcularCostoEnvio(
    datosEnvio.provincia,
    subtotal
  );
  const total = subtotal - descuento + costoEnvio;
  const referencia = `checkout_${idUsuario}_${carrito._id.toString()}_${Date.now()}`;

  const checkout = {
    referencia,
    idUsuario,
    idCarrito: carrito._id.toString(),
    items: normalizarItemsParaCheckout(carrito.items),
    subtotal,
    descuento,
    costoEnvio,
    total,
    datosEnvio,
  };

  const preferencia = await mercadopagoService.crearPreferenciaPago(checkout);

  return preferencia;
}

async function crearOrdenDesdeCheckoutPagado(checkout, pago) {
  if (!checkout.referencia) {
    return null;
  }

  const pagoId = pago.id?.toString();
  const filtrosExistente = [{ "mercadoPago.externalReference": checkout.referencia }];

  if (pagoId) {
    filtrosExistente.push({ "pago.paymentId": pagoId });
  }

  const ordenExistente = await collection().findOne({
    $or: filtrosExistente,
  });

  if (ordenExistente) {
    return ordenExistente;
  }

  if (!ObjectId.isValid(checkout.idUsuario) || !ObjectId.isValid(checkout.idCarrito)) {
    return null;
  }

  const numeroCompra = await generarNumeroCompra();
  const orden = {
    idUsuario: new ObjectId(checkout.idUsuario),
    numeroCompra,
    estado: "pagada",
    items: checkout.items || [],
    subtotal: checkout.subtotal || 0,
    descuento: checkout.descuento || 0,
    costoEnvio: checkout.costoEnvio || 0,
    total: checkout.total || pago.transaction_amount || 0,
    datosEnvio: checkout.datosEnvio,
    pago: {
      metodo: "mercado_pago",
      proveedor: "mercado_pago",
      estado: "aprobado",
      paymentId: pagoId,
      statusDetail: pago.status_detail || null,
      transactionAmount: pago.transaction_amount || checkout.total || 0,
      marcaTarjeta: pago.payment_method_id || null,
      ultimos4: pago.card?.last_four_digits || null,
    },
    mercadoPago: {
      preferenceId: pago.preference_id || null,
      externalReference: checkout.referencia,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const resultado = await collection().insertOne(orden);
  const ordenCreada = { ...orden, _id: resultado.insertedId };

  await getDB().collection("carritos").updateOne(
    {
      _id: new ObjectId(checkout.idCarrito),
      idUsuario: new ObjectId(checkout.idUsuario),
      estado: "abierto",
    },
    {
      $set: {
        estado: "cerrado",
        cerradoAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  await descontarStockDeOrden(ordenCreada);

  const usuario = await usuariosService.getUsuariosById(checkout.idUsuario);

  if (usuario?.email) {
    emailService.enviarConfirmacionCompra(usuario.email, ordenCreada);
  }

  return ordenCreada;
}

async function actualizarOrdenExistentePagada(pago) {
  const idOrden = pago.external_reference;

  if (!idOrden || !ObjectId.isValid(idOrden)) {
    return null;
  }

  const orden = await getOrdenById(idOrden);

  if (!orden) {
    return null;
  }

  const yaEstabaPagada = ESTADOS_PAGO_CONFIRMADO.has(orden.estado);
  const datosPagoActualizados = {
    metodo: orden.pago?.metodo || "mercado_pago",
    proveedor: "mercado_pago",
    estado: "aprobado",
    paymentId: pago.id?.toString(),
    statusDetail: pago.status_detail || null,
    transactionAmount: pago.transaction_amount || orden.total,
    marcaTarjeta: pago.payment_method_id || orden.pago?.marcaTarjeta || null,
    ultimos4: pago.card?.last_four_digits || orden.pago?.ultimos4 || null,
  };

  await collection().updateOne(
    { _id: orden._id },
    {
      $set: {
        estado: yaEstabaPagada ? orden.estado : "pagada",
        pago: datosPagoActualizados,
        updatedAt: new Date(),
      },
    }
  );

  const ordenActualizada = await collection().findOne({ _id: orden._id });

  if (!yaEstabaPagada) {
    await descontarStockDeOrden(ordenActualizada);

    const usuario = await usuariosService.getUsuariosById(orden.idUsuario.toString());

    if (usuario?.email) {
      emailService.enviarConfirmacionCompra(usuario.email, ordenActualizada);
    }
  }

  return ordenActualizada;
}

export async function actualizarOrdenDesdePagoMercadoPago(pago) {
  if (pago.status !== "approved") {
    return null;
  }

  const checkout = obtenerCheckoutDesdePago(pago);

  if (checkout) {
    return crearOrdenDesdeCheckoutPagado(checkout, pago);
  }

  return actualizarOrdenExistentePagada(pago);
}
