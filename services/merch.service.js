import { ObjectId } from "mongodb";
import { getDB } from "./db.js";

function collection() {
  const db = getDB();
  return db.collection("productos_merch");
}

function construirAlertaStock(stock = 0) {
  if (stock <= 0) {
    return {
      tipo: "sin_stock",
      mensaje: "Sin stock",
    };
  }

  if (stock === 1) {
    return {
      tipo: "ultima_unidad",
      mensaje: "Ultima unidad",
    };
  }

  if (stock <= 3) {
    return {
      tipo: "ultimas_unidades",
      mensaje: "Ultimas unidades",
    };
  }

  return null;
}

function prepararVariantes(variantes = []) {
  return variantes.map((variante) => ({
    ...variante,
    alertaStock: construirAlertaStock(variante.stock ?? 0),
  }));
}

function normalizarImagenes(producto) {
  if (Array.isArray(producto?.imagenes) && producto.imagenes.length > 0) {
    return producto.imagenes;
  }

  if (producto?.imagen) {
    return [
      {
        url: producto.imagen,
      },
    ];
  }

  return [];
}

function prepararProducto(producto) {
  if (!producto) {
    return null;
  }

  const variantes = Array.isArray(producto.variantes)
    ? prepararVariantes(producto.variantes)
    : [];

  const imagenes = normalizarImagenes(producto);
  const imagenPrincipal = imagenes[0]?.url || "";

  return {
    ...producto,
    imagenes,
    imagen: imagenPrincipal,
    alertaStock: construirAlertaStock(producto.stock ?? 0),
    variantes,
  };
}

function prepararPayloadProducto(producto) {
  const imagenesNormalizadas =
    Array.isArray(producto.imagenes) && producto.imagenes.length > 0
      ? producto.imagenes
      : producto.imagen
      ? [{ url: producto.imagen }]
      : [];

  return {
    ...producto,
    imagenes: imagenesNormalizadas,
    imagen: imagenesNormalizadas[0]?.url || producto.imagen || "",
    activo: producto.activo ?? true,
  };
}

export async function getProductosMerch() {
  const productos = await collection().find({ activo: { $ne: false } }).toArray();
  return productos.map(prepararProducto);
}

export async function getProductoMerchById(id) {
  const producto = await collection().findOne({ _id: new ObjectId(id) });
  return prepararProducto(producto);
}

export async function guardarProductoMerch(producto) {
  const productoNuevo = prepararPayloadProducto(producto);
  return collection().insertOne(productoNuevo);
}

export async function editarProductoMerch(id, data) {
  const dataPreparada = prepararPayloadProducto(data);

  return collection().updateOne(
    { _id: new ObjectId(id) },
    { $set: dataPreparada }
  );
}

export async function eliminarProductoMerch(id) {
  return collection().updateOne(
    { _id: new ObjectId(id) },
    { $set: { activo: false } }
  );
}