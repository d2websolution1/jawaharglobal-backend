import express from "express";
import adminAuth from "../middlewares/adminAuth.js";
import { adminLogin, adminSeed, adminChangePassword } from "../controllers/adminAuthController.js";

const router = express.Router();

router.post("/auth/login", adminLogin);
router.post("/auth/seed", adminSeed);
router.put("/auth/change-password", adminAuth, adminChangePassword);
router.put("/change-password", adminAuth, adminChangePassword);

export default router;