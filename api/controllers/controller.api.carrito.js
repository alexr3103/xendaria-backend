import * as service from "../../services/carrito.service.js";

export async function getCarrito(req, res) {
  try {
    const idUsuario = req.user.id;
    const carrito = await service.crearCarritoSiNoExiste(idUsuario);

    return res.status(200).json(carrito);
  } catch (error) {
    console.error("[getCarrito]", error);
    return res.status(500).json({ message: "No se pudo obtener el carrito" });
  }
}

export async function agregarProducto(req, res) {
  try {
    const idUsuario = req.user.id;
    const { idProducto, cantidad, variante } = req.body;

    const carrito = await service.agregarProductoAlCarrito(
      idUsuario,
      idProducto,
      cantidad,
      variante
    );

    if (!carrito) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    return res.status(201).json(carrito);
  } catch (error) {
    console.error("[agregarProducto]", error);

    if (
      error.message === "El producto tiene variantes, debe seleccionar alguna de las opciones disponibles" ||
      error.message.startsWith("El color es obligatorio") ||
      error.message.startsWith("El talle es obligatorio") ||
      error.message.startsWith("El diseno es obligatorio") ||
      error.message === "La variante seleccionada no existe para este producto" ||
      error.message === "La cantidad solicitada supera el stock disponible"
    ) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "No se pudo agregar el producto al carrito" });
  }
}

export async function actualizarCantidadProducto(req, res) {
  try {
    const idUsuario = req.user.id;
    const idProducto = req.params.idProducto;
    const { cantidad, variante } = req.body;

    const carrito = await service.actualizarCantidadProducto(
      idUsuario,
      idProducto,
      cantidad,
      variante
    );

    if (!carrito) {
      return res.status(404).json({ message: "Carrito o producto no encontrado" });
    }

    return res.status(200).json(carrito);
  } catch (error) {
    console.error("[actualizarCantidadProducto]", error);

    if (
      error.message === "El producto tiene variantes, debe seleccionar alguna de las opciones disponibles" ||
      error.message.startsWith("El color es obligatorio") ||
      error.message.startsWith("El talle es obligatorio") ||
      error.message.startsWith("El diseno es obligatorio") ||
      error.message === "La variante seleccionada no existe para este producto" ||
      error.message === "La cantidad solicitada supera el stock disponible"
    ) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "No se pudo actualizar la cantidad del producto" });
  }
}

export async function eliminarProducto(req, res) {
  try {
    const idUsuario = req.user.id;
    const idProducto = req.params.idProducto;
    const { variante } = req.body;

    const carrito = await service.eliminarProductoDelCarrito(
      idUsuario,
      idProducto,
      variante
    );

    if (!carrito) {
      return res.status(404).json({ message: "Carrito o producto no encontrado" });
    }

    return res.status(200).json(carrito);
  } catch (error) {
    console.error("[eliminarProducto]", error);
    return res.status(500).json({ message: "No se pudo eliminar el producto del carrito" });
  }
}