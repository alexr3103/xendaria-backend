import yup from "yup";
import { datosEnvioSchema } from "../schemas/orden.js";

const crearCheckoutMercadoPagoSchema = yup.object({
    datosEnvio: datosEnvioSchema.required("Los datos de envio son obligatorios"),
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
        return res.status(400).json({ message: error.errors });
    }
}
