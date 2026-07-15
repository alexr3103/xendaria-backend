import yup from "yup";

export const varianteSchema = yup.object({
  color: yup.string().trim().optional().max(60),
  talle: yup.string().trim().optional().max(30),
  diseno: yup.string().trim().optional().max(80),
});

export const itemOrdenSchema = yup.object({
  idProducto: yup
    .string()
    .required("El idProducto es obligatorio")
    .matches(/^[0-9a-fA-F]{24}$/, "idProducto no es un ObjectId valido"),

  nombre: yup
    .string()
    .trim()
    .required("El nombre del producto es obligatorio")
    .max(120),

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

export const datosEnvioSchema = yup.object({
  nombreCompleto: yup
    .string()
    .trim()
    .required("El nombre completo es obligatorio")
    .max(120),

  telefono: yup
    .string()
    .trim()
    .required("El telefono es obligatorio")
    .max(40),

  calle: yup
    .string()
    .trim()
    .required("La calle es obligatoria")
    .max(120),

  numero: yup
    .string()
    .trim()
    .required("El numero es obligatorio")
    .max(20),

  pisoDepto: yup
    .string()
    .trim()
    .optional()
    .max(40),

  ciudad: yup
    .string()
    .trim()
    .required("La ciudad es obligatoria")
    .max(80),

  provincia: yup
    .string()
    .trim()
    .required("La provincia es obligatoria")
    .oneOf([
      "capital_federal",
      "conurbano_buenos_aires",
      "buenos_aires",
      "catamarca",
      "chaco",
      "chubut",
      "cordoba",
      "corrientes",
      "entre_rios",
      "formosa",
      "jujuy",
      "la_pampa",
      "la_rioja",
      "mendoza",
      "misiones",
      "neuquen",
      "rio_negro",
      "salta",
      "san_juan",
      "san_luis",
      "santa_cruz",
      "santa_fe",
      "santiago_del_estero",
      "tierra_del_fuego",
      "tucuman"
    ]),

  codigoPostal: yup
    .string()
    .trim()
    .required("El codigo postal es obligatorio")
    .max(20),

  referencias: yup
    .string()
    .trim()
    .optional()
    .max(300),
});

export const pagoSchema = yup.object({
  metodo: yup
    .string()
    .oneOf(["mercado_pago", "tarjeta"])
    .required("El metodo de pago es obligatorio"),

  marcaTarjeta: yup
    .string()
    .oneOf(["visa", "mastercard", "amex"])
    .nullable()
    .optional(),

  ultimos4: yup
    .string()
    .nullable()
    .optional()
    .matches(/^(\d{4})?$/, "Los ultimos 4 deben tener 4 digitos"),

  proveedor: yup
    .string()
    .trim()
    .required("El proveedor de pago es obligatorio")
    .max(60),

  estado: yup
    .string()
    .oneOf(["pendiente", "aprobado", "rechazado"])
    .default("pendiente"),
});

export const ordenSchema = yup.object({
  idUsuario: yup
    .string()
    .required("El idUsuario es obligatorio")
    .matches(/^[0-9a-fA-F]{24}$/, "idUsuario no es un ObjectId valido"),

  numeroCompra: yup
    .string()
    .trim()
    .required("El numero de compra es obligatorio")
    .max(40),

  estado: yup
    .string()
    .oneOf(["pagada", "procesando", "enviada", "cancelada"])
    .default("pagada"),

  items: yup
    .array()
    .of(itemOrdenSchema)
    .min(1, "La orden debe tener al menos un producto")
    .required("Los items son obligatorios"),

  subtotal: yup
    .number()
    .required("El subtotal es obligatorio")
    .min(0),

  descuento: yup
    .number()
    .min(0)
    .default(0)
    .optional(),

  costoEnvio: yup
    .number()
    .required("El costo de envio es obligatorio")
    .min(0),

  total: yup
    .number()
    .required("El total es obligatorio")
    .min(0),

  datosEnvio: datosEnvioSchema.required("Los datos de envio son obligatorios"),

  pago: pagoSchema.required("Los datos de pago son obligatorios"),
});
