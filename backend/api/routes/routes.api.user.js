import { Router } from "express";
import * as controllers from "../controllers/controller.api.user.js";
import { validateRegister, validateLogin } from "../../middleware/usuarios.validate.middleware.js";
import { verifyToken } from "../../middleware/auth.middleware.js";

const route = Router();

//google
route.post("/login/google", controllers.loginGoogle);

//Autenticación
route.post("/register", [validateRegister], controllers.nuevoUsuario);
route.post("/login", [validateLogin], controllers.login);
// Recuperar contraseña
route.post("/recuperar", controllers.recuperarCuenta);
route.post("/reset-password", controllers.resetPassword);

// CRUD (solo autenticados)
route.get("/", verifyToken, controllers.getUsuarios);
route.get("/:id", verifyToken, controllers.getUsuariosById);
route.delete("/:id", verifyToken, controllers.eliminarUsuario);
//route.patch("/:id", verifyToken, controllers.editarUsuario);
/* route.put("/:id", verifyToken, controllers.reemplazarUsuario); */
// Puntos y favoritos (solo autenticados)
route.post("/:idUsuario/punto", verifyToken, controllers.nuevoPunto);
route.get("/:idUsuario/punto", verifyToken, controllers.getPuntoUsuario);
route.post("/:idUsuario/favorito", verifyToken, controllers.nuevoLugarFavorito);
route.delete("/:idUsuario/favorito/:idPunto", verifyToken, controllers.eliminarLugarFavorito);

export default route;