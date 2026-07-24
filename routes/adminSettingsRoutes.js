import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import Settings from "../models/Settings.js";

const router = express.Router();

// ✅ QR Code upload setup
const qrUploadDir = path.join(process.cwd(), "uploads", "settings");
if (!fs.existsSync(qrUploadDir)) {
  fs.mkdirSync(qrUploadDir, { recursive: true });
}

const qrStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, qrUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    cb(null, `qr-code-${Date.now()}${ext}`);
  },
});

function qrFileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG or WEBP images are allowed"));
  }
  cb(null, true);
}

const uploadQr = multer({
  storage: qrStorage,
  fileFilter: qrFileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

// ✅ GET all settings
router.get("/", async (req, res) => {
  try {
    console.log("📥 GET /api/admin/settings");
    const settings = await Settings.findAll();
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    console.log("✅ Settings found:", Object.keys(settingsObj).length);
    res.json(settingsObj);
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ PUT all settings - IMPORTANT
router.put("/", async (req, res) => {
  try {
    console.log("📥 PUT /api/admin/settings - Received:", req.body);

    const updates = req.body;
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No data provided" });
    }

    // ✅ Save each setting
    for (const [key, value] of Object.entries(updates)) {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await Settings.upsert({
        key: key,
        value: stringValue,
      });
      console.log(`   ✅ ${key} saved`);
    }

    // ✅ Return updated settings
    const settings = await Settings.findAll();
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });

    res.json({
      success: true,
      message: "Settings updated successfully",
      data: settingsObj
    });
  } catch (error) {
    console.error("❌ Error updating settings:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Upload QR Code Image
router.post("/upload-qr", uploadQr.single("qrImage"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const qrUrl = `/uploads/settings/${req.file.filename}`;

    await Settings.upsert({
      key: "qr_code_url",
      value: qrUrl,
    });

    console.log("✅ QR code uploaded:", qrUrl);

    res.json({ success: true, qr_code_url: qrUrl });
  } catch (error) {
    console.error("❌ Error uploading QR code:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ GET single setting
router.get("/:key", async (req, res) => {
  try {
    const { key } = req.params;
    console.log(`📥 GET /api/admin/settings/${key}`);
    const setting = await Settings.findOne({ where: { key } });
    if (!setting) {
      return res.status(404).json({ message: "Setting not found" });
    }
    res.json({ key: setting.key, value: setting.value });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ PUT single setting
router.put("/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    console.log(`📥 PUT /api/admin/settings/${key} -`, value);

    await Settings.upsert({
      key: key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    });

    res.json({ success: true, message: "Setting updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;