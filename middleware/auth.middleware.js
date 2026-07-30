import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getDB } from "../services/db.js";

export async function verifyToken(req, res, next) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[verifyToken] JWT_SECRET no configurado");
      return res.status(500).json({ message: "Configuracion de autenticacion incompleta" });
    }

    // Extraemos el token del header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Token no proporcionado" });
    }

    // El formato esperado es: "Bearer <token>"
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Formato de token inválido" });
    }

    // Verificamos el token con la misma secret que usás en createToken()
    const decoded = jwt.verify(token, secret);

    const usuario = await getDB().collection("usuarios").findOne(
      { _id: new ObjectId(decoded.id) },
      { projection: { activo: 1, role: 1 } }
    );

    if (!usuario || usuario.activo === false) {
      return res.status(401).json({
        message: "La cuenta ya no está activa",
      });
    }

    // El rol se lee de la base para que los permisos no dependan de un token viejo.
    req.user = {
      ...decoded,
      role: usuario.role || decoded.role,
    };
    next();

  } catch (err) {
    console.error("[verifyToken]", err);
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}

export function optionalAuth(req, _res, next) {
  try {
    const secret = process.env.JWT_SECRET;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (secret && token) {
      req.user = jwt.verify(token, secret);
    }
  } catch {
    req.user = null;
  }

  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Acceso permitido solo para administradores" });
  }

  next();
}
