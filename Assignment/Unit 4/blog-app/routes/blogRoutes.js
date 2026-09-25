import express from "express";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import authMiddleware from "../middleware/authMiddleware.js";
import { authorizeRoles, checkBlogOwnership } from "../middleware/rbacMiddleware.js";
import Blog from "../models/Blog.js";
import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";

const router = express.Router();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    const id = crypto.randomUUID();
    const extension = path.extname(file.originalname);
    cb(null, `${id}${extension}`);
  },
});

const upload = multer({ storage: storage });

// ─────────────────────────────────────────────
// PUBLIC ROUTES (any visitor can view blogs)
// ─────────────────────────────────────────────

// GET all blogs
router.get("/", async (req, res) => {
  try {
    const blogs = await Blog.find().populate("userId", "name email role");
    return res.status(200).json(blogs);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch blogs", error: error.message });
  }
});

// GET blogs by search
router.get("/search", async (req, res) => {
  try {
    const { s } = req.query;
    if (!s) {
      return res.status(400).json({ message: "Search query 's' is required" });
    }

    const blogs = await Blog.find({
      $or: [
        { title: { $regex: s, $options: "i" } },
        { content: { $regex: s, $options: "i" } },
      ],
    });

    return res.status(200).json(blogs);
  } catch (error) {
    return res.status(500).json({ message: "Search failed", error: error.message });
  }
});

// GET blog by id
router.get("/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate("userId", "name email role");
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }
    return res.status(200).json(blog);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch blog", error: error.message });
  }
});

// ─────────────────────────────────────────────
// PROTECTED ROUTES – Role-Based Access Control
// ─────────────────────────────────────────────

/**
 * POST /blogs  – Create a blog
 * Allowed roles: admin, author
 */
router.post(
  "/",
  authMiddleware,
  authorizeRoles("admin", "author"),
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, content, author } = req.body;

      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }

      let imageUrl = null;
      if (req.file) {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "blogs",
        });
        imageUrl = uploadResult.secure_url;
      }

      const blog = await Blog.create({
        title,
        content,
        author: author || req.user.name,
        userId: req.user._id,
        image: imageUrl,
      });

      return res.status(201).json({
        message: "Blog created successfully",
        blog,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to create blog",
        error: error.message,
      });
    }
  }
);

/**
 * PUT /blogs/:id  – Update a blog
 * Admin  → can update any blog
 * Author → can update only their own blogs
 */
router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("admin", "author"),
  checkBlogOwnership,
  async (req, res) => {
    try {
      const { title, content, author } = req.body;
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (author !== undefined) updateData.author = author;

      const updatedBlog = await Blog.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );

      return res.status(200).json({
        message: "Blog updated successfully",
        blog: updatedBlog,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update blog",
        error: error.message,
      });
    }
  }
);

/**
 * PATCH /blogs/:id  – Partial update (same RBAC as PUT)
 */
router.patch(
  "/:id",
  authMiddleware,
  authorizeRoles("admin", "author"),
  checkBlogOwnership,
  async (req, res) => {
    try {
      const updatedBlog = await Blog.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      return res.status(200).json({
        message: "Blog updated successfully",
        blog: updatedBlog,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update blog",
        error: error.message,
      });
    }
  }
);

/**
 * DELETE /blogs/:id  – Delete a blog
 * Admin  → can delete any blog
 * Author → can delete only their own blogs
 */
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("admin", "author"),
  checkBlogOwnership,
  async (req, res) => {
    try {
      const deletedBlog = await Blog.findByIdAndDelete(req.params.id);

      return res.status(200).json({
        message: "Blog deleted successfully",
        blog: deletedBlog,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to delete blog",
        error: error.message,
      });
    }
  }
);

/**
 * POST /blogs/:id/comment  – Add a comment
 * Allowed roles: admin, author, user (any authenticated user)
 */
router.post("/:id/comment", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          comments: {
            userId: req.user._id,
            username: req.user.name,
            text,
          },
        },
      },
      { new: true }
    );

    if (!updatedBlog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.status(201).json({
      message: "Comment added successfully",
      comments: updatedBlog.comments,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to add comment",
      error: error.message,
    });
  }
});

/**
 * POST /blogs/:id/likes  – Like a blog
 * Any authenticated user
 */
router.post("/:id/likes", authMiddleware, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    const alreadyLiked = blog.likes.some(
      (like) => like.userId.toString() === req.user._id.toString()
    );

    if (alreadyLiked) {
      return res.status(400).json({ message: "You already liked this blog" });
    }

    blog.likes.push({ userId: req.user._id });
    await blog.save();

    return res.status(201).json({ message: "Blog liked successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to like blog",
      error: error.message,
    });
  }
});

export default router;
