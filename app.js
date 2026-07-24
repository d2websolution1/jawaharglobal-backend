import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import multer from "multer";
import routes from "./routes/index.js";
import sequelize from "./config/db.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import adminPlacementsRoutes from "./routes/adminPlacementsRoutes.js";
import adminTestimonialsRoutes from "./routes/adminTestimonialsRoutes.js";
import adminSettingsRoutes from "./routes/adminSettingsRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORS - Allow all origins for testing
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-visitor-id'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.set('Connection', 'keep-alive');
  res.set('Keep-Alive', 'timeout=5, max=100');
  next();
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ API Routes - Specific routes pehle
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin/placements", adminPlacementsRoutes);
app.use("/api/admin/testimonials", adminTestimonialsRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api", routes);

// ✅ 404 Handler - LAST
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ message: "Not Found" });
});

// Multer/upload errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("Multer error:", err.message);
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    console.error("Request error:", err);
    return res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
  next();
});

const start = async () => {
  try {
    await sequelize.authenticate();
    try {
      await sequelize.sync({ alter: true });
    } catch (syncErr) {
      console.warn("Schema alter failed, falling back to plain sync():", syncErr?.message || syncErr);
      await sequelize.sync();
    }

    console.log("Database connected and synced");
    console.log(`Server is running on http://localhost:${PORT}`);

    app.listen(PORT, () => {
      console.log(`✅ Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

start();

export default app;