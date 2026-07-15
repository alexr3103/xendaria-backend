import multer from "multer";
import { uploadImage, deleteImage } from "../../services/cloudinary.service.js";
import * as servicePuntos from "../../services/puntos_visitables.service.js";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen"), false);
    }
  },
});

export const uploadSingle = upload.single("imagen");

function fileToDataURI(file) {
  const b64 = Buffer.from(file.buffer).toString("base64");
  return `data:${file.mimetype};base64,${b64}`;
}

function getTotalFotos(punto) {
  return Array.isArray(punto?.fotos) ? punto.fotos.length : 0;
}

export async function subirInsignia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se proporciono ninguna imagen" });
    }

    const result = await uploadImage(fileToDataURI(req.file), "xendaria/insignias");
    const { idPunto } = req.body;

    if (!idPunto) {
      return res.status(200).json({
        message: "Insignia subida correctamente",
        url: result.url,
        publicId: result.publicId,
      });
    }

    const punto = await servicePuntos.getPuntosById(idPunto, { incluirInactivos: true });
    if (!punto) {
      await deleteImage(result.publicId);
      return res.status(404).json({ message: "Punto no encontrado" });
    }

    await servicePuntos.editarPunto(idPunto, { insignia: result.url });

    return res.status(200).json({
      message: "Insignia subida y punto actualizado correctamente",
      url: result.url,
      publicId: result.publicId,
      puntoId: idPunto,
    });
  } catch (error) {
    console.error("[subirInsignia]", error);
    return res.status(500).json({ message: "Error al subir la insignia" });
  }
}

export async function subirFotoPunto(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se proporciono ninguna imagen" });
    }

    const result = await uploadImage(fileToDataURI(req.file), "xendaria/puntos");
    const foto = {
      url: result.url,
      publicId: result.publicId,
      fechaSubida: new Date(),
    };

    const { idPunto } = req.body;
    if (!idPunto) {
      return res.status(200).json({
        message: "Foto subida correctamente",
        url: result.url,
        publicId: result.publicId,
        foto,
      });
    }

    const punto = await servicePuntos.getPuntosById(idPunto, { incluirInactivos: true });
    if (!punto) {
      await deleteImage(result.publicId);
      return res.status(404).json({ message: "Punto no encontrado" });
    }

    await servicePuntos.agregarFotoPunto(idPunto, foto);
    const puntoActualizado = await servicePuntos.getPuntosById(idPunto, { incluirInactivos: true });

    return res.status(200).json({
      message: "Foto subida y agregada al punto correctamente",
      url: result.url,
      publicId: result.publicId,
      puntoId: idPunto,
      foto,
      totalFotos: getTotalFotos(puntoActualizado),
    });
  } catch (error) {
    console.error("[subirFotoPunto]", error);
    return res.status(500).json({ message: "Error al subir la foto" });
  }
}

export async function eliminarFotoPunto(req, res) {
  try {
    const { idPunto, publicId } = req.body;

    if (!idPunto || !publicId) {
      return res.status(400).json({ message: "Se requiere idPunto y publicId" });
    }

    const punto = await servicePuntos.getPuntosById(idPunto, { incluirInactivos: true });
    if (!punto) {
      return res.status(404).json({ message: "Punto no encontrado" });
    }

    const existeFoto = (punto.fotos || []).some((foto) => foto.publicId === publicId);
    if (!existeFoto) {
      return res.status(404).json({ message: "Foto no encontrada en el punto" });
    }

    await deleteImage(publicId);
    await servicePuntos.eliminarFotoPunto(idPunto, publicId);
    const puntoActualizado = await servicePuntos.getPuntosById(idPunto, { incluirInactivos: true });

    return res.status(200).json({
      message: "Foto eliminada correctamente",
      totalFotos: getTotalFotos(puntoActualizado),
    });
  } catch (error) {
    console.error("[eliminarFotoPunto]", error);
    return res.status(500).json({ message: "Error al eliminar la foto" });
  }
}

export async function eliminarImagen(req, res) {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({ message: "Se requiere el publicId de la imagen" });
    }

    await deleteImage(publicId);
    return res.status(200).json({ message: "Imagen eliminada correctamente" });
  } catch (error) {
    console.error("[eliminarImagen]", error);
    return res.status(500).json({ message: "Error al eliminar la imagen" });
  }
}

export async function subirImagenMerch(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se proporciono ninguna imagen" });
    }

    const result = await uploadImage(fileToDataURI(req.file), "xendaria/merch");

    return res.status(200).json({
      message: "Imagen de merch subida correctamente",
      url: result.url,
      publicId: result.publicId,
      foto: {
        url: result.url,
        publicId: result.publicId,
        fechaSubida: new Date(),
      },
    });
  } catch (error) {
    console.error("[subirImagenMerch]", error);
    return res.status(500).json({ message: "Error al subir la imagen de merch" });
  }
}
