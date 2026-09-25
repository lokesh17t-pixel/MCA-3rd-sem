import express from "express";
import {
  login,
  logout,
  logoutAllDevices,
  register,
  getAllUsers,
  updateUserRole,
  deleteUser,
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import OTP from "../models/OTP.js";
import nodemailer from "nodemailer";
import "dotenv/config";
import Session from "../models/Session.js";
import User from "../models/User.js";

const router = express.Router();

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─────────────────────────────────────────────
// PUBLIC AUTH ROUTES
// ─────────────────────────────────────────────

router.post("/register", register);
router.post("/login", login);

// ─────────────────────────────────────────────
// AUTHENTICATED ROUTES
// ─────────────────────────────────────────────

router.post("/logout", authMiddleware, logout);
router.post("/logout-all", authMiddleware, logoutAllDevices);

// ─────────────────────────────────────────────
// ADMIN-ONLY ROUTES – User Management
// ─────────────────────────────────────────────

/**
 * GET /users  – List all users
 * Role: admin
 */
router.get(
  "/",
  authMiddleware,
  authorizeRoles("admin"),
  getAllUsers
);

/**
 * PATCH /users/:id/role  – Change a user's role
 * Role: admin
 */
router.patch(
  "/:id/role",
  authMiddleware,
  authorizeRoles("admin"),
  updateUserRole
);

/**
 * DELETE /users/:id  – Delete a user
 * Role: admin
 */
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("admin"),
  deleteUser
);

// ─────────────────────────────────────────────
// OTP ROUTES (kept as-is from class project)
// ─────────────────────────────────────────────

router.post("/request-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required for OTP" });
    }

    const otp = crypto.randomInt(1000, 10000);
    const otpHash = await bcrypt.hash(otp.toString(), 12);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OTP.deleteMany({ email });
    await OTP.create({ email, otpHash, expiresAt, attempts: 0 });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "Your OTP",
      text: `Your OTP is ${otp}. Valid for 5 mins`,
    });

    return res.status(200).json({ message: "OTP sent" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to send OTP", error: error.message });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const storedOTP = await OTP.findOne({ email });
    if (!storedOTP) {
      return res.status(404).json({ message: "OTP not found or expired" });
    }

    if (storedOTP.expiresAt < new Date()) {
      await OTP.findByIdAndDelete(storedOTP._id);
      return res.status(400).json({ message: "OTP expired" });
    }

    const isValid = await bcrypt.compare(otp, storedOTP.otpHash);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    await OTP.findByIdAndDelete(storedOTP._id);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const session = await Session.create({
      userId: user._id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    res.cookie("sid", session._id, {
      httpOnly: true,
      signed: true,
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "OTP verified",
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return res.status(500).json({ message: "OTP verification failed", error: error.message });
  }
});

export default router;
