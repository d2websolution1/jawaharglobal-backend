import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import { fileURLToPath } from 'url';

// import certificate from "../models/certificate.js";
import Course from "../models/Course.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import Certificate from "../models/Certificate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hard ceiling on how many keys/bytes we ever accept into `meta`.
const MAX_META_KEYS = 200;
const MAX_META_VALUE_LENGTH = 20000;
const MAX_META_BYTES = 1 * 1024 * 1024;

function safeStringifyMeta(meta) {
  if (meta === null || meta === undefined) return {};
  if (typeof meta === "string") {
    try {
      const parsed = JSON.parse(meta);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof meta !== "object" || Array.isArray(meta)) return {};
  return meta;
}

function safeCleanMeta(rawMeta) {
  let meta = safeStringifyMeta(rawMeta);

  let keys = [];
  try {
    keys = Object.keys(meta);
  } catch {
    return {};
  }

  if (keys.length === 0 || keys.length > MAX_META_KEYS) {
    return {};
  }

  const cleaned = {};
  for (const k of keys) {
    let v;
    try {
      v = meta[k];
    } catch {
      continue;
    }
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed === "") continue;
      if (trimmed.length > MAX_META_VALUE_LENGTH) continue;
      cleaned[k] = trimmed;
    } else if (typeof v === "number" || typeof v === "boolean") {
      cleaned[k] = v;
    }
  }

  return cleaned;
}

export const adminListcertificates = async (req, res) => {
  try {
    const { q, courseSlug, fullName, visitorId, from, to, limit, page } = req.query || {};

    const where = {};

    if (courseSlug) where.courseSlug = String(courseSlug);
    if (visitorId) where.visitorId = String(visitorId);
    if (fullName) where.fullName = { [Op.like]: `%${String(fullName)}%` };

    if (q) {
      const qStr = String(q).trim();
      if (qStr) {
        where[Op.or] = [
          { certificateNumber: { [Op.like]: `%${qStr}%` } },
          { fullName: { [Op.like]: `%${qStr}%` } },
          { courseSlug: { [Op.like]: `%${qStr}%` } },
          { visitorId: { [Op.like]: `%${qStr}%` } },
        ];
      }
    }

    if (from || to) {
      where.issuedAt = {};
      if (from) where.issuedAt[Op.gte] = new Date(String(from));
      if (to) where.issuedAt[Op.lte] = new Date(String(to));
    }

    const take = limit ? Math.max(1, Math.min(200, Number(limit))) : 50;
    const currentPage = page ? Math.max(1, Number(page)) : 1;
    const offset = (currentPage - 1) * take;

    const { rows, count } = await Certificate.findAndCountAll({
      where,
      order: [["issuedAt", "DESC"]],
      attributes: [
        "id",
        "courseSlug",
        "fullName",
        "visitorId",
        "certificateNumber",
        "issuedAt",
        "createdAt",
        "updatedAt",
        "meta",
      ],
      limit: take,
      offset,
    });

    // Ensure photo URLs are properly formatted
    const processedRows = rows.map(row => {
      const data = row.toJSON();
      if (data.meta && data.meta.photoUrl) {
        // Make sure photo URL starts with /uploads/
        if (!data.meta.photoUrl.startsWith('/uploads/')) {
          data.meta.photoUrl = `/uploads/certificates/${path.basename(data.meta.photoUrl)}`;
        }
      }
      return data;
    });

    res.json({ items: processedRows, total: count, page: currentPage, limit: take });
  } catch (err) {
    console.error("adminListcertificates error:", err);
    const msg = err?.errors?.[0]?.message || err?.message || "Server error";
    return res.status(400).json({ message: msg });
  }
};

export const admincertificateStats = async (req, res) => {
  try {
    const [totalcertificates, totalCourses, distinctCourses] = await Promise.all([
      Certificate.count(),
      Course.count(),
      Certificate.aggregate("courseSlug", "DISTINCT", { plain: false }),
    ]);

    const recent = await Certificate.findAll({
      attributes: [
        "id",
        "courseSlug",
        "fullName",
        "visitorId",
        "certificateNumber",
        "issuedAt",
        "createdAt",
        "updatedAt",
        "meta",
      ],
      order: [["issuedAt", "DESC"]],
      limit: 5,
    });

    // Process recent certificates to ensure photo URLs are correct
    const processedRecent = recent.map(row => {
      const data = row.toJSON();
      if (data.meta && data.meta.photoUrl) {
        if (!data.meta.photoUrl.startsWith('/uploads/')) {
          data.meta.photoUrl = `/uploads/certificates/${path.basename(data.meta.photoUrl)}`;
        }
      }
      return data;
    });

    res.json({
      totalcertificates,
      totalCourses,
      distinctCoursesWithcertificates: Array.isArray(distinctCourses) ? distinctCourses.length : 0,
      recent: processedRecent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const adminListEnrollments = async (req, res) => {
  try {
    const {
      q,
      courseSlug,
      fullName,
      visitorId,
      enrollmentNumber,
      email,
      status,
      limit,
      page,
    } = req.query || {};

    const where = {};

    if (courseSlug) where.courseSlug = String(courseSlug);
    if (visitorId) where.visitorId = String(visitorId);
    if (enrollmentNumber) where.enrollmentNumber = String(enrollmentNumber);
    if (email) where.email = String(email);
    if (status) where.status = String(status);
    if (fullName) where.fullName = { [Op.like]: `%${String(fullName)}%` };

    if (q) {
      const qStr = String(q).trim();
      if (qStr) {
        where[Op.or] = [
          { fullName: { [Op.like]: `%${qStr}%` } },
          { courseSlug: { [Op.like]: `%${qStr}%` } },
          { visitorId: { [Op.like]: `%${qStr}%` } },
          { enrollmentNumber: { [Op.like]: `%${qStr}%` } },
          { email: { [Op.like]: `%${qStr}%` } },
        ];
      }
    }

    const take = limit ? Math.max(1, Math.min(200, Number(limit))) : 50;
    const currentPage = page ? Math.max(1, Number(page)) : 1;
    const offset = (currentPage - 1) * take;

    const { rows, count } = await CourseEnrollment.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: take,
      offset,
    });

    res.json({ items: rows, total: count, page: currentPage, limit: take });
  } catch (err) {
    console.error("adminListEnrollments error:", err);
    const msg = err?.errors?.[0]?.message || err?.message || "Server error";
    return res.status(400).json({ message: msg });
  }
};

// FIXED: Enhanced get certificate with proper data formatting
export const adminGetcertificate = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find certificate with all fields
    const certificate = await Certificate.findOne({ 
      where: { id },
      attributes: [
        "id",
        "courseSlug",
        "fullName",
        "visitorId",
        "certificateNumber",
        "issuedAt",
        "createdAt",
        "updatedAt",
        "meta",
      ]
    });

    if (!certificate) {
      return res.status(404).json({ message: "certificate not found" });
    }

    // Convert to plain object and ensure all data is properly formatted
    const certificateData = certificate.toJSON();
    
    // Ensure meta is always a plain object (frontend depends on object fields)
    if (!certificateData.meta || typeof certificateData.meta !== "object" || Array.isArray(certificateData.meta)) {
      if (typeof certificateData.meta === "string") {
        try {
          certificateData.meta = JSON.parse(certificateData.meta);
        } catch {
          certificateData.meta = {};
        }
      } else {
        certificateData.meta = {};
      }
    }


    // Make sure photo URL is correctly formatted if it exists
    if (certificateData.meta.photoUrl) {
      const raw = String(certificateData.meta.photoUrl).trim();
      if (!raw) {
        certificateData.meta.photoUrl = null;
      } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
        // Keep full URL as-is
        certificateData.meta.photoUrl = raw;
      } else {
        // Normalize any input to /uploads/certificates/<filename>
        // If it's a bare filename or other path, keep only basename.
        certificateData.meta.photoUrl = `/uploads/certificates/${path.basename(raw)}`;
      }
    }

    // Log for debugging
    console.log('certificate fetched:', {
      id: certificateData.id,
      fullName: certificateData.fullName,
      meta: certificateData.meta,
      photoUrl: certificateData.meta.photoUrl || 'No photo'
    });

    return res.json(certificateData);
  } catch (err) {
    console.error("adminGetcertificate error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const adminDeletecertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const certificate = await Certificate.findOne({ where: { id } });

    if (!certificate) return res.status(404).json({ message: "certificate not found" });

    const photoUrl = certificate.meta?.photoUrl;
    if (photoUrl && photoUrl.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), photoUrl.replace(/^\//, ""));
      fs.unlink(filePath, () => {});
    }

    await certificate.destroy();
    res.json({ message: "certificate deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// FIXED: Enhanced photo upload with better path handling
export const adminUploadcertificatePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const certificate = await Certificate.findOne({ where: { id } });

    if (!certificate) {
      return res.status(404).json({ message: "certificate not found" });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Delete old photo if exists
    const oldPhotoUrl = certificate.meta?.photoUrl;
    if (oldPhotoUrl && oldPhotoUrl.startsWith("/uploads/")) {
      const oldPath = path.join(process.cwd(), oldPhotoUrl.replace(/^\//, ""));
      fs.unlink(oldPath, (err) => {
        if (err) console.error("Failed to delete old photo:", err);
      });
    }

    // Store photo URL with correct path
    const photoUrl = `/uploads/certificates/${req.file.filename}`;
    const updatedMeta = { 
      ...(certificate.meta || {}), 
      photoUrl 
    };

    await certificate.update({ meta: updatedMeta });

    // Fetch updated certificate with all data
    const updated = await Certificate.findOne({ 
      where: { id },
      attributes: [
        "id",
        "courseSlug",
        "fullName",
        "visitorId",
        "certificateNumber",
        "issuedAt",
        "createdAt",
        "updatedAt",
        "meta",
      ]
    });

    // Return complete certificate data
    const responseData = updated.toJSON();
    
    // Ensure photo URL is properly formatted in response
    if (responseData.meta && responseData.meta.photoUrl) {
      if (!responseData.meta.photoUrl.startsWith('/uploads/')) {
        responseData.meta.photoUrl = `/uploads/certificates/${path.basename(responseData.meta.photoUrl)}`;
      }
    }

    res.json({ 
      message: "Photo uploaded successfully",
      certificate: responseData 
    });
  } catch (err) {
    console.error("adminUploadcertificatePhoto error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function prettifySlug(slug) {
  return String(slug || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (chr) => chr.toUpperCase());
}

function generatecertificateNumber() {
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  const now = Date.now().toString().slice(-6);
  return `JGF-${now}-${rand}`;
}

// FIXED: Enhanced create certificate with proper data handling
export const adminCreatecertificate = async (req, res) => {
  try {
    let rawMetaInput = req.body?.meta;

    if (Array.isArray(rawMetaInput)) {
      rawMetaInput = rawMetaInput[0];
    }

    if (typeof rawMetaInput === "string" && Buffer.byteLength(rawMetaInput, "utf8") > MAX_META_BYTES) {
      return res.status(413).json({ message: "meta payload too large" });
    }

    const cleanMeta = safeCleanMeta(rawMetaInput);

    let { visitorId, enrollmentNumber, email, fullName, courseSlug, issuedAt } = req.body || {};

    let courseSlugStr = (courseSlug && String(courseSlug).trim()) || "";
    if (!courseSlugStr) {
      const fallbackTitle = cleanMeta.courseTitle ? String(cleanMeta.courseTitle).trim() : "";
      if (!fallbackTitle) {
        return res.status(400).json({ message: "courseSlug or courseTitle is required" });
      }
      courseSlugStr = slugify(fallbackTitle);
    }

    const hasFullName = fullName && String(fullName).trim();
    let resolvedVisitorId = visitorId ? String(visitorId).trim() : visitorId;

    if ((!resolvedVisitorId || !String(resolvedVisitorId).trim()) && !hasFullName && (enrollmentNumber || email)) {
      const enrollmentWhere = { courseSlug: courseSlugStr };
      if (enrollmentNumber && String(enrollmentNumber).trim()) {
        enrollmentWhere.enrollmentNumber = String(enrollmentNumber);
      } else if (email && String(email).trim()) {
        enrollmentWhere.email = String(email);
      }

      const enrollment = await CourseEnrollment.findOne({ where: enrollmentWhere });
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found for given courseSlug and enrollment details" });
      }

      resolvedVisitorId = enrollment.visitorId;
      if (!hasFullName) {
        fullName = enrollment.fullName;
      }
    }

    if (!hasFullName) {
      return res.status(400).json({ message: "fullName is required" });
    }

    fullName = String(fullName).trim();

    if (!resolvedVisitorId || !String(resolvedVisitorId).trim()) {
      resolvedVisitorId = String(fullName)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      if (!resolvedVisitorId) {
        resolvedVisitorId = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }
    }
    resolvedVisitorId = String(resolvedVisitorId);

    const course = await Course.findOne({ where: { slug: courseSlugStr } });
    const courseTitleDefault = course ? course.title : prettifySlug(courseSlugStr);

    let issuedAtDate;
    if (issuedAt && String(issuedAt).trim()) {
      const d = new Date(String(issuedAt));
      if (!Number.isNaN(d.getTime())) issuedAtDate = d;
    }

    // Check for existing certificate
    const existing = await Certificate.findOne({ 
      where: { courseSlug: courseSlugStr, visitorId: resolvedVisitorId } 
    });

    // Handle photo upload if file exists
    if (req.file) {
      const photoUrl = `/uploads/certificates/${req.file.filename}`;
      cleanMeta.photoUrl = photoUrl;
    }

    if (existing) {
      // Update existing certificate
      const patch = { fullName };
      if (issuedAtDate) patch.issuedAt = issuedAtDate;

      // Handle photo update - delete old photo if exists
      if (req.file) {
        const oldPhotoUrl = existing.meta?.photoUrl;
        if (oldPhotoUrl && oldPhotoUrl.startsWith("/uploads/")) {
          const oldPath = path.join(process.cwd(), oldPhotoUrl.replace(/^\//, ""));
          fs.unlink(oldPath, (err) => {
            if (err) console.error("Failed to delete old photo:", err);
          });
        }
      }

      const existingMeta = safeCleanMeta(existing.meta);
      patch.meta = { ...existingMeta, ...cleanMeta };

      await existing.update(patch);
      
      // Fetch updated certificate with all data
      const updated = await Certificate.findOne({ 
        where: { id: existing.id },
        attributes: [
          "id",
          "courseSlug",
          "fullName",
          "visitorId",
          "certificateNumber",
          "issuedAt",
          "createdAt",
          "updatedAt",
          "meta",
        ]
      });
      
      const responseData = updated.toJSON();
      
      // Ensure photo URL is properly formatted
      if (responseData.meta && responseData.meta.photoUrl) {
        if (!responseData.meta.photoUrl.startsWith('/uploads/')) {
          responseData.meta.photoUrl = `/uploads/certificates/${path.basename(responseData.meta.photoUrl)}`;
        }
      }
      
      return res.json(responseData);
    }

    // Create new certificate
    const certificatePayload = {
      courseSlug: courseSlugStr,
      fullName,
      visitorId: resolvedVisitorId,
      certificateNumber: generatecertificateNumber(),
      issuedAt: issuedAtDate || new Date(),
      meta: {
        ...cleanMeta,
        courseTitle: cleanMeta.courseTitle || courseTitleDefault,
        // Ensure photoUrl is included if uploaded
        ...(req.file && { photoUrl: `/uploads/certificates/${req.file.filename}` }),
      },
    };

    const certificate = await Certificate.create(certificatePayload);

    // Fetch the created certificate to ensure all data is returned
    const createdcertificate = await Certificate.findOne({
      where: { id: certificate.id },
      attributes: [
        "id",
        "courseSlug",
        "fullName",
        "visitorId",
        "certificateNumber",
        "issuedAt",
        "createdAt",
        "updatedAt",
        "meta",
      ]
    });

    res.status(201).json(createdcertificate);
  } catch (err) {
    console.error("adminCreatecertificate error:", err);
    res.status(500).json({ message: err?.message || "Server error" });
  }
};


