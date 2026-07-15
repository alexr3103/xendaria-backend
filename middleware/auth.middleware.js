import jwt from "jsonwebtoken";

export function verifyToken(req, res, next) {
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

    // Guardamos el usuario decodificado en la request para uso posterior
    req.user = decoded;
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
