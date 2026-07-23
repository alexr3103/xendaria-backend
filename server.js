import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import { connectDB } from "./services/db.js";
import {
    asegurarIndiceGeografico,
    completarUbicacionesGeoJson,
    completarMetadatosPuntos,
} from "./services/puntos_visitables.service.js";
import {
    asegurarIndiceVisitas,
    sincronizarVisitasDesdeUsuarios,
} from "./services/visitas.service.js";
import { asegurarIndiceCalificaciones } from "./services/calificaciones.service.js";
import { asegurarIndicesRutas } from "./services/rutas_recomendadas.service.js";
import { asegurarIndicesTitulos } from "./services/titulos.service.js";
import { initSocket } from "./services/socket.service.js";
import PuntosApiRouter from "./api/routes/routes.api.puntos_visitables.js";
import UsuariosApiRouter from "./api/routes/routes.api.usuarios.js";
import UploadApiRouter from "./api/routes/routes.api.upload.js";
import MerchApiRouter from "./api/routes/routes.api.merch.js";
import CarritoApiRouter from "./api/routes/routes.api.carrito.js";
import OrdenApiRouter from "./api/routes/routes.api.orden.js";
import MercadoPagoApiRouter from "./api/routes/routes.api.mercadopago.js";
import EnviosApiRouter from "./api/routes/routes.api.envios.js";
import RankingApiRouter from "./api/routes/routes.api.ranking.js";
import CalificacionesApiRouter from "./api/routes/routes.api.calificaciones.js";
import RutasApiRouter from "./api/routes/routes.api.rutas_recomendadas.js";
import DashboardApiRouter from "./api/routes/routes.api.dashboard.js";
import TitulosApiRouter from "./api/routes/routes.api.titulos.js";
import PuntosRouter from "./routes/puntos_visitables.route.js";
import UsuariosRouter from "./routes/usuarios.route.js";
import cors from "cors";

const app = express();
const allowedOrigins = [
    "http://localhost:5173",
    process.env.FRONTEND_URL,
].filter(Boolean);
const corsOptions = {
    origin: allowedOrigins,
    credentials: true,
};

//permite las politicas de CORS
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/", express.static("public"));

//Conexión a la base solo una vez
await connectDB();
await asegurarIndiceGeografico();
await completarUbicacionesGeoJson();
await completarMetadatosPuntos();
await asegurarIndiceVisitas();
await sincronizarVisitasDesdeUsuarios();
await asegurarIndiceCalificaciones();
await asegurarIndicesRutas();
await asegurarIndicesTitulos();

// Rutas
app.use("/api/puntos", PuntosApiRouter);
app.use("/api/usuarios", UsuariosApiRouter);
app.use("/api/upload", UploadApiRouter);
app.use("/api/merch", MerchApiRouter);
app.use("/api/carrito", CarritoApiRouter);
app.use("/api/ordenes", OrdenApiRouter);
app.use("/api/mercadopago", MercadoPagoApiRouter);
app.use("/api/envios", EnviosApiRouter);
app.use("/api/ranking", RankingApiRouter);
app.use("/api/calificaciones", CalificacionesApiRouter);
app.use("/api/rutas", RutasApiRouter);
app.use("/api/admin", DashboardApiRouter);
app.use("/api/titulos", TitulosApiRouter);
app.use("/puntos", PuntosRouter);
app.use("/usuarios", UsuariosRouter);
//app.get("/api/health", (_req, res) => {
//  res.json({ ok: true, service: "xendaria-back", time: Date.now() });
//}); Esto es para probar el endpoint y que traiga bien

const PORT = process.env.PORT || 3333;
const server = http.createServer(app);
initSocket(server, corsOptions);

server.listen(PORT, () => console.log(`Funciona, puerto ${PORT}`));
