import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import { connectDB } from "./services/db.js";
import PuntosApiRouter from "./api/routes/routes.api.puntos_visitables.js";
import UsuariosApiRouter from "./api/routes/routes.api.user.js";
import PuntosRouter from "./routes/puntos_visitables.route.js";
import UsuariosRouter from "./routes/usuarios.route.js";

const app = express();


const allowedOrigins = [
  "http://localhost:5173",
  "https://xendaria-arg.vercel.app",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

  // Google OAuth necesita esto para evitar COOP/COEP
  res.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

  if (req.method === "OPTIONS") return res.sendStatus(204);

  next();
});



app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/", express.static("public"));

/* ========= RUTAS ========= */
app.use("/api/puntos", PuntosApiRouter);
app.use("/api/usuarios", UsuariosApiRouter);

app.use("/puntos", PuntosRouter);
app.use("/usuarios", UsuariosRouter);

/* ============================ */

const PORT = process.env.PORT || 3333;

async function start() {
  try {
    console.log("⏳ Conectando a MongoDB...");
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 Backend Xendaria activo en puerto ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Error al iniciar el backend:", error);
    process.exit(1);
  }
}

start();
