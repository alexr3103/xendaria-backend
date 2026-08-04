import yup from "../schemas/yup.js";
import { datosEnvioSchema } from "../schemas/orden.js";
import { getMensajeValidacion } from "../utils/errores.js";

const crearCheckoutMercadoPagoSchema = yup.object({
    datosEnvio: datosEnvioSchema.required("Los datos de envío son obligatorios"),
});

export async function validateCrearCheckoutMercadoPago(req, res, next) {
    try {
        const validated = await crearCheckoutMercadoPagoSchema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });

        req.body = validated;
        next();
    } catch (error) {
        return res.status(400).json({ message: getMensajeValidacion(error) });
    }
}
