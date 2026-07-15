import express from "express"

const route = express.Router()
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173"

route.get("/", (_req, res) => {
  res.redirect(`${FRONTEND_URL}/admin/usuarios`)
})

route.get("/nuevo", (_req, res) => {
  res.redirect(`${FRONTEND_URL}/admin/usuarios`)
})

route.post("/nuevo", (_req, res) => {
  res.redirect(303, `${FRONTEND_URL}/admin/usuarios`)
})

route.get("/modificar/:id", (_req, res) => {
  res.redirect(`${FRONTEND_URL}/admin/usuarios`)
})

route.post("/modificar/:id", (_req, res) => {
  res.redirect(303, `${FRONTEND_URL}/admin/usuarios`)
})

route.get("/eliminar/:id", (_req, res) => {
  res.redirect(`${FRONTEND_URL}/admin/usuarios`)
})

route.post("/eliminar/:id", (_req, res) => {
  res.redirect(303, `${FRONTEND_URL}/admin/usuarios`)
})

route.get("/:id", (_req, res) => {
  res.redirect(`${FRONTEND_URL}/admin/usuarios`)
})

export default route
