export function validateCantidad(req, res, next) {
  const { cantidad } = req.body;

  if (
    cantidad === undefined ||
    !Number.isInteger(Number(cantidad)) ||
    Number(cantidad) < 1
  ) {
    return res.status(400).json({
      message: "La cantidad debe ser un numero entero mayor o igual a 1",
    });
  }

  req.body.cantidad = Number(cantidad);
  next();
}