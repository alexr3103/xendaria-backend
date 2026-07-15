import yup from "yup";

const fotoSchema = yup.object({
  url: yup
    .string()
    .url()
    .required(),

  publicId: yup
    .string()
    .required(),

  fechaSubida: yup
    .date()
    .optional(),
});

const ubicacionSchema = yup.object({
  type: yup
    .string()
    .oneOf(["Point"])
    .required(),

  coordinates: yup
    .array()
    .of(yup.number().required())
    .length(2)
    .required(),
});

const multimediaSchema = yup.object({
  _id: yup
    .string()
    .optional()
    .matches(/^[0-9a-fA-F]{24}$/, "No es un _id de Mongo valido"),

  tipo: yup
    .string()
    .oneOf(["youtube", "spotify", "imagen", "enlace"])
    .required(),

  url: yup
    .string()
    .url()
    .required(),

  titulo: yup
    .string()
    .max(120)
    .optional(),

  descripcion: yup
    .string()
    .max(500)
    .optional(),

  fuente: yup
    .string()
    .max(120)
    .optional(),

  fechaAgregado: yup
    .date()
    .optional(),
});

const vista360Schema = yup.object({
  habilitada: yup
    .boolean()
    .default(false),

  disponible: yup
    .boolean()
    .default(false),

  estado: yup
    .string()
    .nullable(),

  panoId: yup
    .string()
    .nullable(),

  fechaImagen: yup
    .string()
    .nullable(),

  copyright: yup
    .string()
    .nullable(),

  mensaje: yup
    .string()
    .nullable(),

  ultimaVerificacion: yup
    .date()
    .nullable(),
});

const historiaSchema = yup.object({
  titulo: yup
    .string()
    .trim()
    .required("Titulo de historia requerido").max(120),

  contenido: yup
    .string()
    .trim()
    .required("Contenido de historia requerido")
    .max(2000),

  foto: yup
    .string()
    .url()
    .nullable(),
});

export const puntoSchema = yup.object({
  categoria: yup
    .string()
    .required()
    .min(3)
    .max(30),

  categorias: yup
    .array()
    .of(yup.string().min(3).max(30))
    .optional(),

  nombre: yup
    .string()
    .required(),

  activo: yup
    .boolean()
    .default(true),

  lat: yup
    .number()
    .required("Latitud requerida"),

  lon: yup
    .number()
    .required("Longitud requerida"),

  ubicacion: 
    ubicacionSchema.optional(),

  multimedia: yup
    .array()
    .of(multimediaSchema)
    .optional(),

  vista360: 
    vista360Schema.optional(),

  historias: yup
    .array()
    .of(historiaSchema)
    .max(3, "Un punto puede tener hasta 3 historias")
    .optional(),

  foto: yup
    .string()
    .url()
    .nullable(),

  fotos: yup
    .array()
    .of(fotoSchema)
    .optional(),

  descripcion: yup
    .string()
    .required(),

  descripcion_completa: yup
    .string()
    .optional(),

  direccion: yup
    .string()
    .optional(),

  insignia: yup
    .string()
    .url()
    .nullable(),

  _id: yup
    .string()
    .optional()
    .matches(/^[0-9a-fA-F]{24}$/, "No es un _id de Mongo valido"),
});
