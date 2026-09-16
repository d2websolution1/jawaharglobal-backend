import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import { fileURLToPath } from 'url';

import Course from "../models/Course.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import Certificate from "../models/Certificate.js";
import { processUploadedPhoto, normalizePhotoUrl } from "../utils/mediaUpload.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hard ceiling on how many keys/bytes we ever accept into `meta`.
const MAX_META_KEYS = 200;
const MAX_META_VALUE_LENGTH = 20000;
const MAX_META_BYTES = 10 * 1024 * 1024; // Increased to allow base64 images

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
      // Allow longer value for photoUrl (base64)
      if (k !== "photoUrl" && trimmed.length > MAX_META_VALUE_LENGTH) continue;
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

    let take = limit ? Math.max(1, Math.min(200, Number(limit))) : 50;
    if (limit === "all") take = null;

    const currentPage = page ? Math.max(1, Number(page)) : 1;
    const offset = take ? (currentPage - 1) * take : 0;

    const queryOptions = {
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
    };

    if (take) {
      queryOptions.limit = take;
      queryOptions.offset = offset;
    }

    const { rows, count } = await Certificate.findAndCountAll(queryOptions);

    // Ensure photo URLs are properly normalized (leaving base64 and http URLs untouched)
    const processedRows = rows.map(row => {
      const data = row.toJSON();
      if (data.meta && data.meta.photoUrl) {
        data.meta.photoUrl = normalizePhotoUrl(data.meta.photoUrl);
      }
      return data;
    });

    res.json({ 
      items: processedRows, 
      total: count, 
      page: currentPage, 
      limit: take || count 
    });
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

    const processedRecent = recent.map(row => {
      const data = row.toJSON();
      if (data.meta && data.meta.photoUrl) {
        data.meta.photoUrl = normalizePhotoUrl(data.meta.photoUrl);
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

export const adminGetcertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const paramStr = String(id).trim();
    const isNumeric = /^\d+$/.test(paramStr);
    const where = isNumeric
      ? { [Op.or]: [{ id: Number(paramStr) }, { certificateNumber: paramStr }] }
      : { certificateNumber: paramStr };
    
    const certificate = await Certificate.findOne({ 
      where,
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

    const certificateData = certificate.toJSON();
    
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

    if (certificateData.meta.photoUrl) {
      certificateData.meta.photoUrl = normalizePhotoUrl(certificateData.meta.photoUrl);
    }

    return res.json(certificateData);
  } catch (err) {
    console.error("adminGetcertificate error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const adminDeletecertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const cert = await Certificate.findOne({ where: { id } });

    if (!cert) return res.status(404).json({ message: "certificate not found" });

    await cert.destroy();
    res.json({ message: "certificate deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const adminUploadcertificatePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const cert = await Certificate.findOne({ where: { id } });

    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Process photo for permanent storage (Cloudinary CDN or Base64 in PostgreSQL database)
    const photoUrl = await processUploadedPhoto(req.file);

    let currentMeta = cert.meta;
    if (typeof currentMeta === "string") {
      try {
        currentMeta = JSON.parse(currentMeta);
      } catch {
        currentMeta = {};
      }
    }
    if (!currentMeta || typeof currentMeta !== "object") {
      currentMeta = {};
    }

    const updatedMeta = { 
      ...currentMeta, 
      photoUrl 
    };

    await cert.update({ meta: updatedMeta });

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

    const responseData = updated.toJSON();
    if (responseData.meta && responseData.meta.photoUrl) {
      responseData.meta.photoUrl = normalizePhotoUrl(responseData.meta.photoUrl);
    }

    res.json({ 
      message: "Photo uploaded and saved permanently",
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

    // Process photo if uploaded
    if (req.file) {
      const permanentPhotoUrl = await processUploadedPhoto(req.file);
      if (permanentPhotoUrl) {
        cleanMeta.photoUrl = permanentPhotoUrl;
      }
    }

    // Check for existing certificate
    const existing = await Certificate.findOne({ 
      where: { courseSlug: courseSlugStr, visitorId: resolvedVisitorId } 
    });

    if (existing) {
      const patch = { fullName };
      if (issuedAtDate) patch.issuedAt = issuedAtDate;

      const existingMeta = safeCleanMeta(existing.meta);
      patch.meta = { ...existingMeta, ...cleanMeta };

      await existing.update(patch);
      
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
      if (responseData.meta && responseData.meta.photoUrl) {
        responseData.meta.photoUrl = normalizePhotoUrl(responseData.meta.photoUrl);
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
      },
    };

    const createdCert = await Certificate.create(certificatePayload);

    const createdcertificate = await Certificate.findOne({
      where: { id: createdCert.id },
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

    const resp = createdcertificate.toJSON();
    if (resp.meta && resp.meta.photoUrl) {
      resp.meta.photoUrl = normalizePhotoUrl(resp.meta.photoUrl);
    }

    res.status(201).json(resp);
  } catch (err) {
    console.error("adminCreatecertificate error:", err);
    res.status(500).json({ message: err?.message || "Server error" });
  }
};
