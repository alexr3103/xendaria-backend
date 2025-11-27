import yup from 'yup'

export const puntoSchema = yup.object({
  categoria: yup.string().required().min(3).max(30),
  nombre: yup.string().required(),
  lat: yup.number().required("Latitud requerida"),
  lon: yup.number().required("Longitud requerida"),
  foto: yup.string().url().nullable(),
  descripcion: yup.string().required(),
  descripcion_completa: yup.string().optional(),
  direccion: yup.string().optional(),
  insignia: yup.string().url().nullable(),
  insignia: yup.string().url().nullable(),
  _id: yup.string().optional().matches(/^[0-9a-fA-F]{24}$/, "No es un _id de Mongo válido")
});
