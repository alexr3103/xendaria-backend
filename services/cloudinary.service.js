import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function assertCloudinaryConfig() {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error("Credenciales de Cloudinary no configuradas");
  }
}

export async function uploadImage(dataURI, folder) {
  assertCloudinaryConfig();

  const result = await cloudinary.uploader.upload(dataURI, {
    folder,
    resource_type: "image",
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function deleteImage(publicId) {
  assertCloudinaryConfig();
  return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
