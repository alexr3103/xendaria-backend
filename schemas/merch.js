import yup from "yup";

const varianteSchema = yup.object({
  color: yup.string().trim().optional().max(60),
  talle: yup.string().trim().optional().max(30),
  diseno: yup.string().trim().optional().max(60),
  stock: yup.number().integer().min(0).optional(),
});

const imagenSchema = yup.object({
  url: yup
    .string()
    .url("La URL de la imagen no es valida")
    .required("La URL de la imagen es obligatoria"),

  publicId: yup
    .string()
    .trim()
    .optional(),

  fechaSubida: yup
    .date()
    .optional(),
});

export const productoMerchSchema = yup.object({
  nombre: yup
    .string()
    .trim()
    .required("El nombre es obligatorio")
    .max(120),

  descripcion: yup
    .string()
    .trim()
    .required("La descripcion es obligatoria")
    .max(1000),

  precio: yup
    .number()
    .required("El precio es obligatorio")
    .min(0),

  stock: yup
    .number()
    .integer("El stock debe ser un numero entero")
    .required("El stock es obligatorio")
    .min(0),

  categoria: yup
    .string()
    .trim()
    .required("La categoria es obligatoria")
    .max(80),

  imagen: yup
    .string()
    .url("La imagen debe ser una URL valida")
    .optional(),

  imagenes: yup
    .array()
    .of(imagenSchema)
    .optional(),

  variantes: yup
    .array()
    .of(varianteSchema)
    .optional(),

  activo: yup
    .boolean()
    .default(true),
})
  .test(
    "al-menos-una-imagen",
    "Debe haber al menos una imagen",
    (value) => {
      const tieneImagenVieja = !!value?.imagen;
      const tieneImagenes = Array.isArray(value?.imagenes) && value.imagenes.length > 0;

      return tieneImagenVieja || tieneImagenes;
    }
  );