import { Router } from "express";
import { verifyToken, requireAdmin } from "../../middleware/auth.middleware.js";
import { validateBodyObjectId, validateOptionalBodyObjectId } from "../../middleware/objectid.validate.middleware.js";
import {
  uploadSingle,
  subirInsignia,
  subirFotoPunto,
  eliminarFotoPunto,
  eliminarImagen,
  subirImagenMerch,
} from "../controllers/controller.api.upload.js";

const route = Router();

route.post("/insignia", verifyToken, requireAdmin, uploadSingle, validateOptionalBodyObjectId("idPunto"), subirInsignia);
route.post("/punto", verifyToken, requireAdmin, uploadSingle, validateOptionalBodyObjectId("idPunto"), subirFotoPunto);
route.post("/merch", verifyToken, requireAdmin, uploadSingle, subirImagenMerch);
route.delete("/punto/foto", verifyToken, requireAdmin, validateBodyObjectId("idPunto"), eliminarFotoPunto);
route.delete("/imagen", verifyToken, requireAdmin, eliminarImagen);

route.use((err, _req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "La imagen no debe superar los 5MB" });
  }

  if (err?.message) {
    return res.status(400).json({ message: err.message });
  }

  return res.status(500).json({ message: "Error al procesar la imagen" });
});

export default route;
