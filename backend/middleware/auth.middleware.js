import jwt from "jsonwebtoken";

export function verifyToken(req, res, next) {
  try {
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
    const secret = "xendaria_secret_key"; // idealmente ponerlo en .env
    const decoded = jwt.verify(token, secret);

    // Guardamos el usuario decodificado en la request para uso posterior
    req.user = decoded;
    next();

  } catch (err) {
    console.error("[verifyToken]", err);
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}