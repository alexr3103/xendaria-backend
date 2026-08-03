import { registerSchema, loginSchema } from "../schemas/usuarios.js";
import { getMensajeValidacion } from "../utils/errores.js";

export async function validateRegister(req, res, next) {
  try {
    const validated = await registerSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    req.body = validated;
    next();
  } catch (error) {
    res.status(400).json({ message: getMensajeValidacion(error) });
  }
}

export async function validateLogin(req, res, next) {
  try {
    const validated = await loginSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    req.body = validated;
    next();
  } catch (error) {
    res.status(400).json({ message: getMensajeValidacion(error) });
  }
}
