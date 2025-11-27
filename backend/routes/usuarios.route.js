import express from "express"
import * as controller from "../controllers/usuarios.controller.js"

const route = express.Router()

route.get("/nuevo", controller.formularioNuevoUsuario)
route.post("/nuevo", controller.guardarUsuario)
route.get( "/", controller.getUsuarios)
route.get( "/:id", controller.getUsuariosById)
route.get("/modificar/:id", controller.formularioModificarUsuario)
route.post("/modificar/:id", controller.editarUsuario)
route.get( "/eliminar/:id", controller.formularioEliminarUsuario)
route.post( "/eliminar/:id", controller.eliminarUsuario)

export default route