import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";

import AdminUser from "../models/AdminUser.js";

const JWT_SECRET = process.env.JWT_ADMIN_SECRET || "change_me_admin_secret";

function signToken(admin) {
  return jwt.sign(
    { id: admin.id, role: admin.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_ADMIN_EXPIRES_IN || "7d" }
  );
}

export const adminLogin = async (req, res) => {
  try {
    const { identifier, email, username, password } = req.body || {};
    const loginId = String(identifier || email || username || "").trim();

    if (!loginId) return res.status(400).json({ message: "username/email is required" });
    if (!password) return res.status(400).json({ message: "password is required" });

    const admin =
      (await AdminUser.findOne({ where: { username: loginId } })) ||
      (await AdminUser.findOne({ where: { email: loginId } }));

    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(String(password), admin.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(admin);
    return res.json({ token, user: { id: admin.id, username: admin.username, email: admin.email, role: admin.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const adminChangePassword = async (req, res) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { currentPassword, newPassword } = req.body || {};

    if (!newPassword || String(newPassword).trim().length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    const admin = await AdminUser.findByPk(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    if (!currentPassword) {
      return res.status(400).json({ message: "Current password is required" });
    }

    const ok = await bcrypt.compare(String(currentPassword), admin.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(String(newPassword).trim(), 10);
    admin.passwordHash = passwordHash;
    await admin.save();

    return res.json({ success: true, message: "Admin password updated successfully!" });
  } catch (err) {
    console.error("adminChangePassword error:", err);
    return res.status(500).json({ message: "Server error updating password" });
  }
};

export const adminSeed = async (req, res) => {
  try {
    const seedUsername = process.env.ADMIN_SEED_USERNAME || "admin";
    const seedEmail = process.env.ADMIN_SEED_EMAIL || "admin@example.com";
    const seedPassword = process.env.ADMIN_SEED_PASSWORD || "admin123";

    const existing = await AdminUser.findOne({ where: { username: seedUsername } });
    if (existing) {
      return res.json({ message: "Admin already exists" });
    }

    const passwordHash = await bcrypt.hash(seedPassword, 10);
    await AdminUser.create({
      username: seedUsername,
      email: seedEmail,
      passwordHash,
      role: "admin",
      isActive: true,
    });

    return res.json({ message: "Admin seeded" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};