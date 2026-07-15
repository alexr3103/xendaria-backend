import * as service from "../../services/orden.service.js";

export async function getMisOrdenes(req, res) {
    try {
        const idUsuario = req.user.id;
        const ordenes = await service.getOrdenesByUsuario(idUsuario);

        return res.status(200).json(ordenes);
    } catch (error) {
        console.error("[getMisOrdenes]", error);
        return res.status(500).json({ message: "No se pudieron obtener las ordenes del usuario" });
    }
}

export async function getOrdenes(req, res) {
    try {
        const ordenes = await service.getOrdenes();
        return res.status(200).json(ordenes);
    } catch (error) {
        console.error("[getOrdenes]", error);
        return res.status(500).json({ message: "No se pudieron obtener las ordenes" });
    }
}

export async function actualizarEstadoOrden(req, res) {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        const orden = await service.actualizarEstadoOrden(id, estado);

        if (!orden) {
        return res.status(404).json({ message: "Orden no encontrada" });
        }

        return res.status(200).json(orden);
    } catch (error) {
        console.error("[actualizarEstadoOrden]", error);
        return res
        .status(error.statusCode || 500)
        .json({ message: error.message || "No se pudo actualizar la orden" });
    }
}

export async function crearPreferenciaMercadoPagoDesdeCarrito(req, res) {
    try {
        const idUsuario = req.user.id;
        const { datosEnvio } = req.body;

        const preferencia = await service.crearPreferenciaMercadoPagoDesdeCarrito(
            idUsuario,
            datosEnvio
        );

        if (!preferencia) {
            return res.status(400).json({
                message: "No se puede generar un pago con un carrito vacio",
            });
        }

        return res.status(200).json(preferencia);
    } catch (error) {
        console.error("[crearPreferenciaMercadoPagoDesdeCarrito]", error);
        return res
            .status(error.statusCode || 500)
            .json({ message: error.message || "No se pudo crear la preferencia de Mercado Pago" });
    }
}
