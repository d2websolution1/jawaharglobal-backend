import { Op } from "sequelize";
import certificate from "../models/Certificate.js";
import Course from "../models/Course.js";
import { processUploadedPhoto, normalizePhotoUrl } from "../utils/mediaUpload.js";

function getVisitorId(req) {
  return req.headers["x-visitor-id"] || req.query?.visitorId || req.body?.visitorId;
}

export const listMycertificates = async (req, res) => {
  try {
    const visitorId = getVisitorId(req);
    if (!visitorId) return res.status(400).json({ message: "visitorId is required" });

    const certificates = await certificate.findAll({
      where: { visitorId },
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
    });

    const processed = certificates.map((row) => {
      const data = row.toJSON();
      if (data.meta && data.meta.photoUrl) {
        data.meta.photoUrl = normalizePhotoUrl(data.meta.photoUrl);
      }
      return data;
    });

    res.json(processed);
  } catch (err) {
    console.error("❌ listMycertificates error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

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

    let take = 25;
    let currentPage = 1;
    let offset = 0;

    if (limit && limit !== "all") {
      take = Math.max(1, Math.min(200, Number(limit)));
      currentPage = page ? Math.max(1, Number(page)) : 1;
      offset = (currentPage - 1) * take;
    } else if (limit === "all") {
      take = null;
    }

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

    const { rows, count } = await certificate.findAndCountAll(queryOptions);

    const processedRows = rows.map((row) => {
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
      limit: take || count,
      totalPages: take ? Math.ceil(count / take) : 1
    });
  } catch (err) {
    console.error("adminListcertificates error:", err);
    return res.status(400).json({ message: err?.message || "Server error" });
  }
};

export const getcertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const visitorId = getVisitorId(req);

    const paramStr = String(id).trim();
    const isNumeric = /^\d+$/.test(paramStr);
    const where = isNumeric
      ? { [Op.or]: [{ id: Number(paramStr) }, { certificateNumber: paramStr }] }
      : { certificateNumber: paramStr };

    const certificateData = await certificate.findOne({ where });
    
    if (!certificateData) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    const course = await Course.findOne({ where: { slug: certificateData.courseSlug } });

    let metaData = {};
    if (certificateData.meta) {
      if (typeof certificateData.meta === "string") {
        try {
          metaData = JSON.parse(certificateData.meta);
        } catch (e) {
          metaData = {};
        }
      } else {
        metaData = certificateData.meta;
      }
    }

    if (metaData.photoUrl) {
      metaData.photoUrl = normalizePhotoUrl(metaData.photoUrl);
    }

    const certType = metaData.certificateType || "certificate";
    const displayName = certType === "diploma" ? "Diploma" : "Certificate";

    const responseData = {
      ...certificateData.toJSON(),
      courseTitle: course?.title || metaData?.courseTitle || certificateData.courseSlug,
      certificateType: certType,
      displayName: displayName,
      meta: metaData,
    };

    res.json(responseData);
  } catch (err) {
    console.error("❌ getcertificate error:", err);
    res.status(500).json({ 
      message: "Server error while fetching certificate",
      error: err.message 
    });
  }
};

export const verifyCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        isValid: false,
        message: "Certificate ID is required"
      });
    }

    const paramStr = String(id).trim();
    const isNumeric = /^\d+$/.test(paramStr);
    const where = isNumeric
      ? { [Op.or]: [{ id: Number(paramStr) }, { certificateNumber: paramStr }] }
      : { certificateNumber: paramStr };

    const certificateData = await certificate.findOne({ where });

    if (!certificateData) {
      return res.status(404).json({
        isValid: false,
        message: "Certificate not found. Please check the ID and try again."
      });
    }

    const course = await Course.findOne({
      where: { slug: certificateData.courseSlug }
    });

    let metaData = {};
    if (certificateData.meta) {
      if (typeof certificateData.meta === "string") {
        try {
          metaData = JSON.parse(certificateData.meta);
        } catch (e) {
          metaData = {};
        }
      } else {
        metaData = certificateData.meta;
      }
    }

    if (!metaData.courseTitle) {
      metaData.courseTitle = course?.title || certificateData.courseSlug;
    }

    if (metaData.photoUrl) {
      metaData.photoUrl = normalizePhotoUrl(metaData.photoUrl);
    }

    const certType = metaData.certificateType || "certificate";
    const displayName = certType === "diploma" ? "Diploma" : "Certificate";

    const responseData = {
      isValid: true,
      certificate: {
        id: certificateData.id,
        fullName: certificateData.fullName,
        certificateNumber: certificateData.certificateNumber,
        courseSlug: certificateData.courseSlug,
        visitorId: certificateData.visitorId,
        issuedAt: certificateData.issuedAt || certificateData.createdAt,
        verificationId: certificateData.certificateNumber,
        createdAt: certificateData.createdAt,
        updatedAt: certificateData.updatedAt,
        certificateType: certType,
        displayName: displayName,
        meta: metaData
      }
    };

    res.json(responseData);
  } catch (error) {
    console.error("❌ Certificate verification error:", error);
    return res.status(500).json({
      isValid: false,
      message: "Server error. Please try again later."
    });
  }
};

export const updateCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, courseSlug, visitorId, enrollmentNumber, email, issuedAt, meta } = req.body;
    const photo = req.file;

    const certificateData = await certificate.findByPk(id);
    if (!certificateData) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    if (fullName) certificateData.fullName = fullName;
    if (courseSlug) certificateData.courseSlug = courseSlug;
    if (visitorId) certificateData.visitorId = visitorId;
    if (enrollmentNumber) certificateData.enrollmentNumber = enrollmentNumber;
    if (email) certificateData.email = email;
    if (issuedAt) certificateData.issuedAt = issuedAt;

    let mergedMeta = certificateData.meta || {};
    if (typeof mergedMeta === "string") {
      try {
        mergedMeta = JSON.parse(mergedMeta);
      } catch {
        mergedMeta = {};
      }
    }

    if (meta) {
      const incomingMeta = typeof meta === "string" ? JSON.parse(meta) : meta;
      mergedMeta = { ...mergedMeta, ...incomingMeta };
    }

    // Process new photo if uploaded
    if (photo) {
      const permanentPhotoUrl = await processUploadedPhoto(photo);
      if (permanentPhotoUrl) {
        mergedMeta.photoUrl = permanentPhotoUrl;
      }
    }

    certificateData.meta = mergedMeta;
    await certificateData.save();
    
    const updatedData = await certificate.findByPk(id);
    let updatedMeta = updatedData.meta || {};
    if (typeof updatedMeta === "string") {
      try {
        updatedMeta = JSON.parse(updatedMeta);
      } catch {
        updatedMeta = {};
      }
    }

    if (updatedMeta.photoUrl) {
      updatedMeta.photoUrl = normalizePhotoUrl(updatedMeta.photoUrl);
    }

    const certType = updatedMeta.certificateType || "certificate";
    const displayName = certType === "diploma" ? "Diploma" : "Certificate";

    res.json({ 
      success: true, 
      message: "Certificate updated successfully", 
      certificate: {
        ...updatedData.toJSON(),
        certificateType: certType,
        displayName: displayName,
        meta: updatedMeta
      }
    });
  } catch (error) {
    console.error("❌ Update certificate error:", error);
    res.status(500).json({ 
      message: error.message || "Failed to update certificate" 
    });
  }
};