import { ObjectId } from "mongodb";

export function validateObjectId(...paramNames) {
  return (req, res, next) => {
    for (const paramName of paramNames) {
      const value = req.params[paramName];

      if (!value || !ObjectId.isValid(value)) {
        return res.status(400).json({
          message: `Parametro ${paramName} no es un ObjectId valido`,
        });
      }
    }

    next();
  };
}

export function validateBodyObjectId(...fieldNames) {
  return (req, res, next) => {
    for (const fieldName of fieldNames) {
      const value = req.body[fieldName];

      if (!value || !ObjectId.isValid(value)) {
        return res.status(400).json({
          message: `Campo ${fieldName} no es un ObjectId valido`,
        });
      }
    }

    next();
  };
}

export function validateOptionalBodyObjectId(...fieldNames) {
  return (req, res, next) => {
    for (const fieldName of fieldNames) {
      const value = req.body[fieldName];

      if (value && !ObjectId.isValid(value)) {
        return res.status(400).json({
          message: `Campo ${fieldName} no es un ObjectId valido`,
        });
      }
    }

    next();
  };
}
