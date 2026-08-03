import * as yup from "yup";

yup.setLocale({
  mixed: {
    default: "El valor ingresado no es válido.",
    required: "Este campo es obligatorio.",
    oneOf: "Seleccioná una opción válida.",
    notType: "El valor ingresado no tiene el formato esperado.",
  },
  string: {
    email: "Ingresá un correo electrónico válido.",
    url: "Ingresá un enlace válido.",
    min: "El texto ingresado es demasiado corto.",
    max: "El texto ingresado es demasiado largo.",
    matches: "El formato ingresado no es válido.",
  },
  number: {
    min: "El número ingresado es menor al permitido.",
    max: "El número ingresado supera el máximo permitido.",
    integer: "Ingresá un número entero.",
    positive: "Ingresá un número mayor que cero.",
  },
  array: {
    min: "Faltan elementos para completar este campo.",
    max: "Se ingresaron más elementos de los permitidos.",
    length: "La cantidad de elementos no es válida.",
  },
  date: {
    min: "La fecha ingresada es anterior a la permitida.",
    max: "La fecha ingresada es posterior a la permitida.",
  },
});

export default yup;
