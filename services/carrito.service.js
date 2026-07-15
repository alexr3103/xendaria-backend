import { ObjectId } from "mongodb";
import { getDB } from "./db.js";
import * as merchService from "./merch.service.js";

function collection() {
  const db = getDB();
  return db.collection("carritos");
}

export async function getCarritoByUsuario(idUsuario) {
  return collection().findOne({
    idUsuario: new ObjectId(idUsuario),
    estado: "abierto",
  });
}

export async function crearCarritoSiNoExiste(idUsuario) {
  let carrito = await getCarritoByUsuario(idUsuario);

  if (!carrito) {
    const nuevoCarrito = {
      idUsuario: new ObjectId(idUsuario),
      estado: "abierto",
      items: [],
      total: 0,
    };

    const resultado = await collection().insertOne(nuevoCarrito);
    carrito = { ...nuevoCarrito, _id: resultado.insertedId };
  }

  return carrito;
}

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

function obtenerClavesVariante(variantes = []) {
  const claves = new Set();

  for (const variante of variantes) {
    if (variante.color) {
      claves.add("color");
    }

    if (variante.talle) {
      claves.add("talle");
    }

    if (variante.diseno) {
      claves.add("diseno");
    }
  }

  return Array.from(claves);
}

function validarVarianteRequerida(producto, variante) {
  const variantes = producto.variantes || [];

  if (!variantes.length) {
    return { ok: true };
  }

  if (!variante) {
    return {
      ok: false,
      message: "El producto tiene variantes, debe seleccionar alguna de las opciones disponibles",
    };
  }

  const clavesRequeridas = obtenerClavesVariante(variantes);

  for (const clave of clavesRequeridas) {
    if (!variante[clave]) {
      return {
        ok: false,
        message: `El ${clave} es obligatorio para este producto`,
      };
    }
  }

  return { ok: true };
}

function buscarVarianteProducto(producto, variante) {
  const variantes = producto.variantes || [];

  if (!variantes.length) {
    return null;
  }

  return variantes.find((item) => mismaVariante(item, variante)) || null;
}

function obtenerStockDisponible(producto, varianteProducto) {
  if (varianteProducto) {
    return varianteProducto.stock ?? 0;
  }

  return producto.stock ?? 0;
}

export async function agregarProductoAlCarrito(idUsuario, idProducto, cantidad, variante) {
  const carrito = await crearCarritoSiNoExiste(idUsuario);
  const producto = await merchService.getProductoMerchById(idProducto);

  if (!producto || producto.activo === false) {
    return null;
  }

  const validacionVariante = validarVarianteRequerida(producto, variante);

  if (!validacionVariante.ok) {
    throw new Error(validacionVariante.message);
  }

  const varianteProducto = buscarVarianteProducto(producto, variante);

  if ((producto.variantes || []).length && !varianteProducto) {
    throw new Error("La variante seleccionada no existe para este producto");
  }

  const items = [...carrito.items];

  const index = items.findIndex(
    (item) =>
      item.idProducto.toString() === idProducto &&
      mismaVariante(item.variante, variante)
  );

  const cantidadActual = index >= 0 ? items[index].cantidad : 0;
  const cantidadTotal = cantidadActual + cantidad;
  const stockDisponible = obtenerStockDisponible(producto, varianteProducto);

  if (cantidadTotal > stockDisponible) {
    throw new Error("La cantidad solicitada supera el stock disponible");
  }

  if (index >= 0) {
    items[index].cantidad = cantidadTotal;
    items[index].subtotal = items[index].precioUnitario * items[index].cantidad;
  } else {
    items.push({
      idProducto: producto._id,
      nombre: producto.nombre,
      imagen: producto.imagen,
      precioUnitario: producto.precio,
      cantidad,
      subtotal: producto.precio * cantidad,
      variante,
    });
  }

  const total = items.reduce((acc, item) => acc + item.subtotal, 0);

  await collection().updateOne(
    { _id: carrito._id },
    {
      $set: {
        items,
        total,
      },
    }
  );

  return collection().findOne({ _id: carrito._id });
}

export async function eliminarProductoDelCarrito(idUsuario, idProducto, variante) {
  const carrito = await getCarritoByUsuario(idUsuario);

  if (!carrito) {
    return null;
  }

  const existeItem = carrito.items.some(
    (item) =>
      item.idProducto.toString() === idProducto &&
      mismaVariante(item.variante, variante)
  );

  if (!existeItem) {
    return null;
  }

  const items = carrito.items.filter(
    (item) =>
      !(
        item.idProducto.toString() === idProducto &&
        mismaVariante(item.variante, variante)
      )
  );

  const total = items.reduce((acc, item) => acc + item.subtotal, 0);

  await collection().updateOne(
    { _id: carrito._id },
    {
      $set: {
        items,
        total,
      },
    }
  );

  return collection().findOne({ _id: carrito._id });
}

export async function actualizarCantidadProducto(idUsuario, idProducto, cantidad, variante) {
  const carrito = await getCarritoByUsuario(idUsuario);

  if (!carrito) {
    return null;
  }

  const producto = await merchService.getProductoMerchById(idProducto);

  if (!producto || producto.activo === false) {
    return null;
  }

  const validacionVariante = validarVarianteRequerida(producto, variante);

  if (!validacionVariante.ok) {
    throw new Error(validacionVariante.message);
  }

  const varianteProducto = buscarVarianteProducto(producto, variante);

  if ((producto.variantes || []).length && !varianteProducto) {
    throw new Error("La variante seleccionada no existe para este producto");
  }

  const existeItem = carrito.items.some(
    (item) =>
      item.idProducto.toString() === idProducto &&
      mismaVariante(item.variante, variante)
  );

  if (!existeItem) {
    return null;
  }

  const stockDisponible = obtenerStockDisponible(producto, varianteProducto);

  if (cantidad > stockDisponible) {
    throw new Error("La cantidad solicitada supera el stock disponible");
  }

  const items = carrito.items.map((item) => {
    if (
      item.idProducto.toString() === idProducto &&
      mismaVariante(item.variante, variante)
    ) {
      return {
        ...item,
        cantidad,
        subtotal: item.precioUnitario * cantidad,
      };
    }

    return item;
  });

  const total = items.reduce((acc, item) => acc + item.subtotal, 0);

  await collection().updateOne(
    { _id: carrito._id },
    {
      $set: {
        items,
        total,
      },
    }
  );

  return collection().findOne({ _id: carrito._id });
}