import yup from "yup";

const varianteSchema = yup.object({
  color: yup.string().trim().optional().max(60),
  talle: yup.string().trim().optional().max(30),
  diseno: yup.string().trim().optional().max(60),
});

const itemCarritoSchema = yup.object({
  idProducto: yup
    .string()
    .required("El idProducto es obligatorio")
    .matches(/^[0-9a-fA-F]{24}$/, "idProducto no es un ObjectId valido"),

  nombre: yup
    .string()
    .trim()
    .required("El nombre del producto es obligatorio")
    .max(120),

  imagen: yup
    .string()
    .url("La imagen debe ser una URL valida")
    .optional(),

  precioUnitario: yup
    .number()
    .required("El precio unitario es obligatorio")
    .min(0),

  cantidad: yup
    .number()
    .integer("La cantidad debe ser un numero entero")
    .required("La cantidad es obligatoria")
    .min(1),

  subtotal: yup
    .number()
    .required("El subtotal es obligatorio")
    .min(0),

  variante: varianteSchema.optional(),
});

export const carritoSchema = yup.object({
  idUsuario: yup
    .string()
    .required("El idUsuario es obligatorio")
    .matches(/^[0-9a-fA-F]{24}$/, "idUsuario no es un ObjectId valido"),

  estado: yup
    .string()
    .oneOf(["abierto", "cerrado"])
    .default("abierto"),

  items: yup
    .array()
    .of(itemCarritoSchema)
    .default([]),

  total: yup
    .number()
    .required("El total es obligatorio")
    .min(0),
});