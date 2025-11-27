import express from "express"
import * as controller from "../controllers/puntos_visitables.controller.js"

const route = express.Router()

route.get("/nuevo", controller.formularioNuevoPunto)
route.post("/nuevo", controller.guardarPunto)
route.get( "/", controller.getPuntos)
route.get( "/:id", controller.getPuntosById)
route.get("/modificar/:id", controller.formularioModificarPunto)
route.post("/modificar/:id", controller.editarPunto)
route.get( "/eliminar/:id", controller.formularioEliminar)
route.post( "/eliminar/:id", controller.eliminarPunto)

export default route