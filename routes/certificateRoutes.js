import express from "express";
import { 
  listMycertificates, 
  getcertificate, 
  verifyCertificate,
  updateCertificate
} from "../controllers/certificatesController.js";
import certificate from "../models/Certificate.js";

const router = express.Router();

// ✅ SPECIFIC ROUTES
router.get("/verify/:id", verifyCertificate);
router.get("/my", listMycertificates);
router.get("/debug/all", async (req, res) => {
  try {
    const certs = await certificate.findAll();
    res.json(certs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

import upload from "../middlewares/upload.js";

// ✅ UPDATE ROUTE - PUT (Supports JSON & multipart/form-data with photo)
router.put("/:id", upload.single("photo"), updateCertificate);

// ✅ GET ROUTE - LAST
router.get("/:id", getcertificate);

export default router;