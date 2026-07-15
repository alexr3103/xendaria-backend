import express from "express"

const route = express.Router()
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173"

route.get("/", (_req, res) => {
  res.redirect(`${FRONTEND_URL}/admin/puntos`)
})

route.get("/nuevo", (_req, res) => {
  res.redirect(`${FRONTEND_URL}/admin/puntos/nuevopunto`)
})

route.post("/nuevo", (_req, res) => {
  res.redirect(303, `${FRONTEND_URL}/admin/puntos/nuevopunto`)
})

route.get("/modificar/:id", (req, res) => {
  res.redirect(`${FRONTEND_URL}/admin/puntos/${req.params.id}`)
})

route.post("/modificar/:id", (req, res) => {
  res.redirect(303, `${FRONTEND_URL}/admin/puntos/${req.params.id}`)
})

route.get("/eliminar/:id", (req, res) => {
  res.redirect(`${FRONTEND_URL}/admin/puntos/${req.params.id}`)
})

route.post("/eliminar/:id", (_req, res) => {
  res.redirect(303, `${FRONTEND_URL}/admin/puntos`)
})

route.get("/:id", (req, res) => {
  res.redirect(`${FRONTEND_URL}/admin/puntos/${req.params.id}`)
})

export default route
