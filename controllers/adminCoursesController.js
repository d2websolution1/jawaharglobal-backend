import Course from "../models/Course.js";
import CourseModule from "../models/CourseModule.js";
import { processUploadedPhoto, normalizePhotoUrl } from "../utils/mediaUpload.js";

export const adminUploadCourseImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    const uploadedUrl = await processUploadedPhoto(req.file);
    if (!uploadedUrl) {
      return res.status(500).json({ message: "Failed to process image" });
    }
    return res.json({ success: true, imageUrl: uploadedUrl });
  } catch (err) {
    console.error("adminUploadCourseImage error:", err);
    return res.status(500).json({ message: err.message || "Failed to upload image" });
  }
};

export const adminListCourses = async (req, res) => {
  try {
    const courses = await Course.findAll({ order: [["createdAt", "DESC"]] });
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const adminGetCourse = async (req, res) => {
  try {
    const { slug } = req.params;
    const course = await Course.findOne({ where: { slug } });
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err?.message || "Server error" });
  }
};

export const adminCreateCourse = async (req, res) => {
  try {
    const { slug, title, description, level, coverImageUrl, durationHours, isActive } = req.body || {};

    if (!slug || !String(slug).trim()) return res.status(400).json({ message: "slug is required" });
    if (!title || !String(title).trim()) return res.status(400).json({ message: "title is required" });

    const existing = await Course.findOne({ where: { slug } });
    if (existing) return res.status(409).json({ message: "Course slug already exists" });

    let finalCoverImageUrl = coverImageUrl;
    if (req.file) {
      const uploaded = await processUploadedPhoto(req.file);
      if (uploaded) finalCoverImageUrl = uploaded;
    }

    const course = await Course.create({
      slug,
      title,
      description,
      level,
      coverImageUrl: finalCoverImageUrl,
      durationHours: durationHours ?? null,
      isActive: isActive ?? true,
    });

    res.status(201).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err?.message || "Server error" });
  }
};

export const adminUpdateCourse = async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, description, level, coverImageUrl, durationHours, isActive } = req.body || {};

    const course = await Course.findOne({ where: { slug } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    let finalCoverImageUrl = coverImageUrl;
    if (req.file) {
      const uploaded = await processUploadedPhoto(req.file);
      if (uploaded) finalCoverImageUrl = uploaded;
    }

    await course.update({
      title: title ?? course.title,
      description: description ?? course.description,
      level: level ?? course.level,
      coverImageUrl: finalCoverImageUrl ?? course.coverImageUrl,
      durationHours: durationHours ?? course.durationHours,
      isActive: isActive ?? course.isActive,
    });

    res.json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err?.message || "Server error" });
  }
};

export const adminDeleteCourse = async (req, res) => {
  try {
    const { slug } = req.params;

    const course = await Course.findOne({ where: { slug } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    await CourseModule.destroy({ where: { courseSlug: slug } });
    await course.destroy();

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err?.message || "Server error" });
  }
};

export const adminListModules = async (req, res) => {
  try {
    const { slug } = req.params;
    const modules = await CourseModule.findAll({
      where: { courseSlug: slug },
      order: [["orderIndex", "ASC"]],
    });
    res.json(modules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err?.message || "Server error" });
  }
};

export const adminUpsertModule = async (req, res) => {
  try {
    const { slug } = req.params;
    const { id, title, orderIndex, content, videoUrl, quiz } = req.body || {};

    if (!title || !String(title).trim()) return res.status(400).json({ message: "title is required" });
    if (orderIndex === undefined || orderIndex === null) {
      return res.status(400).json({ message: "orderIndex is required" });
    }

    if (id) {
      const module = await CourseModule.findOne({ where: { id, courseSlug: slug } });
      if (!module) return res.status(404).json({ message: "Module not found" });

      await module.update({
        title,
        orderIndex,
        content,
        videoUrl,
        quiz: quiz ?? module.quiz,
      });

      return res.json(module);
    }

    const module = await CourseModule.create({
      courseSlug: slug,
      title,
      orderIndex,
      content,
      videoUrl,
      quiz: quiz ?? null,
    });

    return res.status(201).json(module);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const adminDeleteModule = async (req, res) => {
  try {
    const { slug, id } = req.params;

    const module = await CourseModule.findOne({ where: { id, courseSlug: slug } });
    if (!module) return res.status(404).json({ message: "Module not found" });

    await module.destroy();
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};