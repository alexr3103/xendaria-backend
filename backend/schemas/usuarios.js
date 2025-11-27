import * as yup from 'yup';

export const registerSchema = yup.object({
  nombre: yup.string().required("El nombre es obligatorio"),
  email: yup.string().email("Email inválido").required("El email es obligatorio"),
  password: yup
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .matches(/[0-9]/, "La contraseña debe tener al menos un número")
    .matches(/[A-Z]/, "La contraseña debe tener al menos una mayúscula")
    .matches(/[!@#$%^&*(),.?":{}|<>_\-+=]/, "La contraseña debe tener al menos un caracter especial")
    .required("La contraseña es obligatoria"),
  passwordConfirm: yup
    .string()
    .oneOf([yup.ref("password")], "Las contraseñas deben coincidir")
    .required("Confirmar contraseña es obligatorio"),
  foto: yup.string().optional(),
  descripcion: yup.string().optional(),
  lugares_favoritos: yup.array().optional(),
});

export const loginSchema = yup.object({
  email: yup.string().email("Email inválido").required("El email es obligatorio"),
  password: yup
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .matches(/[0-9]/, "La contraseña debe tener al menos un número")
    .matches(/[A-Z]/, "La contraseña debe tener al menos una mayúscula")
    .matches(/[!@#$%^&*(),.?\":{}|<>_\-+=]/, "La contraseña debe tener al menos un caracter especial")
    .required("La contraseña es obligatoria"),
});