import { Op } from "sequelize";
import certificate from "../models/Certificate.js";
import Course from "../models/Course.js";
import path from "path";
import fs from "fs";

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
      ],
    });

    res.json(certificates);
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

    // ✅ Pagination with "all" support
    let take = 25;
    let currentPage = 1;
    let offset = 0;

    if (limit && limit !== "all") {
      take = Math.max(1, Math.min(200, Number(limit)));
      currentPage = page ? Math.max(1, Number(page)) : 1;
      offset = (currentPage - 1) * take;
    } else if (limit === "all") {
      take = null; // No limit - show all
    }

    console.log(`📊 Page: ${currentPage}, Limit: ${take || 'ALL'}, Offset: ${offset}`);

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

    const processedRows = rows.map(row => {
      const data = row.toJSON();
      if (data.meta && data.meta.photoUrl) {
        if (!data.meta.photoUrl.startsWith('/uploads/')) {
          data.meta.photoUrl = `/uploads/certificates/${path.basename(data.meta.photoUrl)}`;
        }
      }
      return data;
    });

    console.log(`✅ Found ${count} certificates, returning ${processedRows.length}`);

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

    console.log("🔍 getcertificate called with ID:", id);
    console.log("🔍 Visitor ID:", visitorId);

    const certificateData = await certificate.findOne({ where: { id } });
    
    console.log("📄 Certificate found:", certificateData ? "Yes" : "No");
    
    if (!certificateData) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    if (visitorId && certificateData.visitorId && certificateData.visitorId !== visitorId) {
      console.warn("⚠️ Visitor mismatch:", { visitorId, certVisitorId: certificateData.visitorId });
    }

    const course = await Course.findOne({ where: { slug: certificateData.courseSlug } });

    let metaData = {};
    if (certificateData.meta) {
      if (typeof certificateData.meta === 'string') {
        try {
          metaData = JSON.parse(certificateData.meta);
        } catch (e) {
          console.error("Failed to parse meta:", e);
          metaData = {};
        }
      } else {
        metaData = certificateData.meta;
      }
    }

    const certType = metaData.certificateType || "certificate";
    const displayName = certType === 'diploma' ? 'Diploma' : 'Certificate';

    const responseData = {
      ...certificateData.toJSON(),
      courseTitle: course?.title || certificateData.meta?.courseTitle || certificateData.courseSlug,
      certificateType: certType,
      displayName: displayName,
      meta: metaData,
    };

    console.log("✅ Sending certificate data:", {
      id: responseData.id,
      fullName: responseData.fullName,
      certificateNumber: responseData.certificateNumber,
      courseSlug: responseData.courseSlug,
      courseTitle: responseData.courseTitle,
      type: responseData.certificateType,
      displayName: responseData.displayName,
      metaKeys: Object.keys(responseData.meta)
    });

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
    
    console.log("🔍 Verifying certificate ID:", id);

    if (!id) {
      return res.status(400).json({
        isValid: false,
        message: "Certificate ID is required"
      });
    }

    const certificateData = await certificate.findOne({
      where: { certificateNumber: id }
    });

    console.log("📄 Found certificate:", certificateData ? "Yes" : "No");

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
      if (typeof certificateData.meta === 'string') {
        try {
          metaData = JSON.parse(certificateData.meta);
        } catch (e) {
          console.error("Failed to parse meta:", e);
          metaData = {};
        }
      } else {
        metaData = certificateData.meta;
      }
    }

    if (!metaData.courseTitle) {
      metaData.courseTitle = course?.title || certificateData.courseSlug;
    }

    const certType = metaData.certificateType || "certificate";
    const displayName = certType === 'diploma' ? 'Diploma' : 'Certificate';

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

    console.log("✅ Sending verification response:", {
      id: responseData.certificate.id,
      fullName: responseData.certificate.fullName,
      courseTitle: responseData.certificate.meta.courseTitle,
      type: responseData.certificate.certificateType,
      displayName: responseData.certificate.displayName
    });

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

    console.log("🔍 Updating certificate ID:", id);
    console.log("📝 Data received:", { fullName, courseSlug, visitorId, enrollmentNumber, email, issuedAt });

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

    if (meta) {
      const metaData = typeof meta === 'string' ? JSON.parse(meta) : meta;
      if (!metaData.certificateType && certificateData.meta?.certificateType) {
        metaData.certificateType = certificateData.meta.certificateType;
      }
      if (!metaData.photoUrl && certificateData.meta?.photoUrl) {
        metaData.photoUrl = certificateData.meta.photoUrl;
      }
      certificateData.meta = { ...(certificateData.meta || {}), ...metaData };
    }

    if (photo && photo.filename) {
      const oldPhoto = certificateData.meta?.photoUrl;
      if (oldPhoto && oldPhoto.startsWith("/uploads/")) {
        const oldPath = path.join(process.cwd(), oldPhoto.replace(/^\//, ""));
        fs.unlink(oldPath, () => {});
      }
      const photoUrl = `/uploads/certificates/${photo.filename}`;
      certificateData.meta = { ...(certificateData.meta || {}), photoUrl };
    }

    await certificateData.save();
    
    const updatedData = await certificate.findByPk(id);
    let updatedMeta = {};
    if (updatedData.meta) {
      updatedMeta = typeof updatedData.meta === 'string' ? JSON.parse(updatedData.meta) : updatedData.meta;
    }
    const certType = updatedMeta.certificateType || "certificate";
    const displayName = certType === 'diploma' ? 'Diploma' : 'Certificate';

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