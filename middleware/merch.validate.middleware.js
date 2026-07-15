import { productoMerchSchema } from "../schemas/merch.js";

export function validateProductoMerch(req, res, next) {
  productoMerchSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  })
    .then((data) => {
      req.body = data;
      next();
    })
    .catch((error) => res.status(400).json({ message: error.errors }));
}