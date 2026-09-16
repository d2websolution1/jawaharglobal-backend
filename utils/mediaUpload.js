import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

// Initialize Cloudinary if credentials are provided in environment
if (
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Normalizes a photo URL so that:
 * - Data URLs (base64), HTTP/HTTPS links, and blobs are left untouched.
 * - Relative paths starting with /uploads/ are preserved.
 * - Bare filenames are prepended with /uploads/certificates/
 */
export function normalizePhotoUrl(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  if (
    str.startsWith("data:") ||
    str.startsWith("http://") ||
    str.startsWith("https://") ||
    str.startsWith("blob:")
  ) {
    return str;
  }
  if (str.startsWith("/uploads/")) {
    return str;
  }
  if (str.startsWith("uploads/")) {
    return `/${str}`;
  }
  return `/uploads/certificates/${path.basename(str)}`;
}

/**
 * Permanently stores an uploaded file.
 * 1. If Cloudinary credentials are set in environment, uploads to Cloudinary CDN.
 * 2. Otherwise (or on Cloudinary error), converts file buffer to a persistent Base64 Data URL
 *    stored directly in the database (never lost on Render restarts!).
 */
export async function processUploadedPhoto(file) {
  if (!file) return null;

  // Check if Cloudinary is configured
  const isCloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET)
  );

  if (isCloudinaryConfigured) {
    try {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "jawaharglobal/certificates",
            resource_type: "image",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        if (file.buffer) {
          stream.end(file.buffer);
        } else if (file.path && fs.existsSync(file.path)) {
          fs.createReadStream(file.path).pipe(stream);
        } else {
          reject(new Error("No buffer or file path found"));
        }
      });

      if (uploadResult && uploadResult.secure_url) {
        console.log("☁️ Image uploaded to Cloudinary:", uploadResult.secure_url);
        return uploadResult.secure_url;
      }
    } catch (cloudErr) {
      console.warn("⚠️ Cloudinary upload failed, falling back to Base64:", cloudErr?.message || cloudErr);
    }
  }

  // Base64 storage in database (permanent, survives Render restarts & redeploys)
  if (file.buffer) {
    const mime = file.mimetype || "image/jpeg";
    const base64String = `data:${mime};base64,${file.buffer.toString("base64")}`;
    console.log("💾 Image stored permanently as Base64 Data URL in database");
    return base64String;
  }

  if (file.path && fs.existsSync(file.path)) {
    const fileBuffer = fs.readFileSync(file.path);
    const mime = file.mimetype || "image/jpeg";
    const base64String = `data:${mime};base64,${fileBuffer.toString("base64")}`;
    console.log("💾 Image stored permanently as Base64 Data URL in database (from file path)");
    return base64String;
  }

  return file.filename ? `/uploads/certificates/${file.filename}` : null;
}
