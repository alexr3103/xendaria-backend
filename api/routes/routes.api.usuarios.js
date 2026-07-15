import { Router } from "express";
import * as controllers from "../controllers/controller.api.usuarios.js";
import { validateRegister, validateLogin } from "../../middleware/usuarios.validate.middleware.js";
import { verifyToken, requireAdmin } from "../../middleware/auth.middleware.js";
import { validateBodyObjectId, validateObjectId } from "../../middleware/objectid.validate.middleware.js";

const route = Router();

//google
route.post("/login/google", controllers.loginGoogle);

//Autenticación
route.post("/register", [validateRegister], controllers.nuevoUsuario);
route.post("/login", [validateLogin], controllers.login);
// Recuperar contraseña
route.post("/recuperar", controllers.recuperarCuenta);
route.post("/reset-password", controllers.resetPassword);

// CRUD admin / perfil
route.get("/", verifyToken, requireAdmin, controllers.getUsuarios);
route.get("/admin/puntos-propios/resumen", verifyToken, requireAdmin, controllers.getResumenPuntosPropiosAdmin);
route.get("/:id", verifyToken, validateObjectId("id"), controllers.getUsuariosById);
route.delete("/:id", verifyToken, requireAdmin, validateObjectId("id"), controllers.eliminarUsuario);
route.patch("/:id", verifyToken, validateObjectId("id"), controllers.editarUsuario);
/* route.put("/:id", verifyToken, controllers.reemplazarUsuario); */

// Puntos y favoritos (solo autenticados)
route.post("/:idUsuario/puntos-propios", verifyToken, validateObjectId("idUsuario"), controllers.nuevoPunto);
route.get("/:idUsuario/puntos-propios", verifyToken, validateObjectId("idUsuario"), controllers.getPuntoUsuario);
route.post("/:idUsuario/puntos-propios/:idPunto/vista-360/consultar", verifyToken, validateObjectId("idUsuario", "idPunto"), controllers.consultarVista360PuntoPropio);
route.patch("/:idUsuario/puntos-propios/:idPunto", verifyToken, validateObjectId("idUsuario", "idPunto"), controllers.editarPuntoPropio);
route.delete("/:idUsuario/puntos-propios/:idPunto", verifyToken, validateObjectId("idUsuario", "idPunto"), controllers.eliminarPuntoPropio);
route.get("/:idUsuario/puntos-propios/:idPunto", verifyToken, validateObjectId("idUsuario", "idPunto"), controllers.getPuntoPropioById);
route.post("/:idUsuario/punto", verifyToken, validateObjectId("idUsuario"), controllers.nuevoPunto);
route.get("/:idUsuario/punto", verifyToken, validateObjectId("idUsuario"), controllers.getPuntoUsuario);
route.get("/:idUsuario/visitados", verifyToken, validateObjectId("idUsuario"), controllers.getPuntosVisitadosUsuario);
route.post("/:idUsuario/visitados", verifyToken, validateObjectId("idUsuario"), validateBodyObjectId("idPunto"), controllers.registrarPuntoVisitado);
route.get("/:idUsuario/favoritos", verifyToken, validateObjectId("idUsuario"), controllers.getFavoritosUsuario);
route.post("/:idUsuario/favorito", verifyToken, validateObjectId("idUsuario"), validateBodyObjectId("idPunto"), controllers.nuevoLugarFavorito);
route.delete("/:idUsuario/favorito/:idPunto", verifyToken, validateObjectId("idUsuario", "idPunto"), controllers.eliminarLugarFavorito);

export default route;
