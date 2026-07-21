import * as service from "../../services/merch.service.js";
import { deleteImage } from "../../services/cloudinary.service.js";

export async function getProductosMerch(req, res) {
  try {
    const productos = await service.getProductosMerch();
    return res.status(200).json(productos);
  } catch (error) {
    console.error("[getProductosMerch]", error);
    return res.status(500).json({ message: "Error al obtener los productos" });
  }
}

export async function getProductosMerchAdmin(req, res) {
  try {
    const productos = await service.getProductosMerch({ incluirInactivos: true });
    return res.status(200).json(productos);
  } catch (error) {
    console.error("[getProductosMerchAdmin]", error);
    return res.status(500).json({ message: "Error al obtener los productos" });
  }
}

export async function getProductoMerchById(req, res) {
  try {
    const id = req.params.id;
    const producto = await service.getProductoMerchById(id);

    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    return res.status(200).json(producto);
  } catch (error) {
    console.error("[getProductoMerchById]", error);
    return res.status(500).json({ message: "Error al obtener el producto" });
  }
}

export async function getProductoMerchAdminById(req, res) {
  try {
    const id = req.params.id;
    const producto = await service.getProductoMerchById(id, {
      incluirInactivos: true,
    });

    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    return res.status(200).json(producto);
  } catch (error) {
    console.error("[getProductoMerchAdminById]", error);
    return res.status(500).json({ message: "Error al obtener el producto" });
  }
}

export async function nuevoProductoMerch(req, res) {
  try {
    const producto = req.body;
    const resultado = await service.guardarProductoMerch(producto);

    return res.status(201).json({
      message: "Producto creado correctamente",
      id: resultado.insertedId,
    });
  } catch (error) {
    console.error("[nuevoProductoMerch]", error);
    return res.status(500).json({ message: "No se pudo crear el producto" });
  }
}

export async function editarProductoMerch(req, res) {
  try {
    const id = req.params.id;
    const { imagenesEliminadas = [], ...data } = req.body;

    const producto = await service.getProductoMerchById(id, {
      incluirInactivos: true,
    });

    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const resultado = await service.editarProductoMerch(id, data);

    const publicIdsAEliminar = Array.isArray(imagenesEliminadas)
      ? imagenesEliminadas.filter(Boolean)
      : [];

    for (const publicId of publicIdsAEliminar) {
      try {
        await deleteImage(publicId);
      } catch (error) {
        console.error("[editarProductoMerch][deleteImage]", publicId, error);
      }
    }

    return res.status(202).json(resultado);
  } catch (error) {
    console.error("[editarProductoMerch]", error);
    return res.status(500).json({ message: "No se pudo editar el producto" });
  }
}

export async function actualizarEstadoProductoMerch(req, res) {
  try {
    const id = req.params.id;
    const { activo } = req.body;

    if (typeof activo !== "boolean") {
      return res.status(400).json({ message: "El campo activo debe ser booleano" });
    }

    const producto = await service.getProductoMerchById(id, {
      incluirInactivos: true,
    });

    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    await service.actualizarEstadoProductoMerch(id, activo);

    return res.status(200).json({
      message: activo ? "Producto habilitado" : "Producto deshabilitado",
      activo,
    });
  } catch (error) {
    console.error("[actualizarEstadoProductoMerch]", error);
    return res.status(500).json({ message: "No se pudo actualizar el producto" });
  }
}

export async function eliminarProductoMerch(req, res) {
  try {
    const id = req.params.id;

    const producto = await service.getProductoMerchById(id, {
      incluirInactivos: true,
    });

    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    await service.eliminarProductoMerch(id);

    const imagenes = Array.isArray(producto.imagenes) ? producto.imagenes : [];
    const publicIdsAEliminar = imagenes
      .map((imagen) => imagen?.publicId)
      .filter(Boolean);

    for (const publicId of publicIdsAEliminar) {
      try {
        await deleteImage(publicId);
      } catch (error) {
        console.error("[eliminarProductoMerch][deleteImage]", publicId, error);
      }
    }

    return res.status(200).json({
      message: "Producto eliminado correctamente",
    });
  } catch (error) {
    console.error("[eliminarProductoMerch]", error);
    return res.status(500).json({ message: "No se pudo eliminar el producto" });
  }
}
