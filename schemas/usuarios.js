import yup from "./yup.js";

const PASSWORD_NUMBER_REGEX = /[0-9]/;
const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
const PASSWORD_SPECIAL_CHARACTER_REGEX = /[!@#$%^&*(),.?":{}|<>_+=-]/;

export const registerSchema = yup.object({
  nombre: yup
    .string()
    .required("El nombre es obligatorio"),
    
  email: yup
    .string()
    .email("Email inválido")
    .required("El email es obligatorio"),

  password: yup
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .matches(PASSWORD_NUMBER_REGEX, "La contraseña debe tener al menos un número")
    .matches(PASSWORD_UPPERCASE_REGEX, "La contraseña debe tener al menos una mayúscula")
    .matches(PASSWORD_SPECIAL_CHARACTER_REGEX, "La contraseña debe tener al menos un caracter especial")
    .required("La contraseña es obligatoria"),

  passwordConfirm: yup
    .string()
    .oneOf([yup.ref("password")], "Las contraseñas deben coincidir")
    .required("La confirmación de contraseña es obligatoria"),

  aceptaTerminos: yup
    .boolean()
    .oneOf([true], "Tenés que aceptar los términos y la política de privacidad")
    .required("Tenés que aceptar los términos y la política de privacidad"),

  foto: yup
    .string()
    .optional(),

  descripcion: yup
    .string()
    .max(150, "La descripción no puede superar los 150 caracteres")
    .optional(),

  lugares_favoritos: yup
    .array()
    .optional(),
});

export const loginSchema = yup.object({
  email: yup
    .string()
    .email("Email inválido")
    .required("El email es obligatorio"),

  password: yup
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .matches(PASSWORD_NUMBER_REGEX, "La contraseña debe tener al menos un número")
    .matches(PASSWORD_UPPERCASE_REGEX, "La contraseña debe tener al menos una mayúscula")
    .matches(PASSWORD_SPECIAL_CHARACTER_REGEX, "La contraseña debe tener al menos un caracter especial")
    .required("La contraseña es obligatoria"),
});
