import Session from "../models/Session.js";
import User from "../models/User.js";
import bcrypt from "bcrypt";

/**
 * Register a new user
 * Default role = "user"
 * Allowed roles on register: "user" | "author"
 * (Admin accounts should be created manually or via a seed script)
 */
export async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields (name, email, password) are required to register" });
    }

    // Only allow "user" or "author" during self-registration
    const allowedSelfRoles = ["user", "author"];
    const assignedRole = allowedSelfRoles.includes(role) ? role : "user";

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists with this email" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: assignedRole,
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed", error: error.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Remove previous sessions for this user (single-session policy)
    await Session.deleteMany({ userId: user._id });

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
      message: "User logged in successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
}

export async function logout(req, res) {
  try {
    await Session.deleteOne({ userId: req.user._id });
    res.clearCookie("sid");
    return res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Logout failed", error: error.message });
  }
}

export async function logoutAllDevices(req, res) {
  try {
    await Session.deleteMany({ userId: req.user._id });
    res.clearCookie("sid");
    return res.status(200).json({ message: "Logged out from all devices" });
  } catch (error) {
    return res.status(500).json({ message: "Logout failed", error: error.message });
  }
}

/**
 * Admin-only: Get all users
 */
export async function getAllUsers(req, res) {
  try {
    const users = await User.find().select("-password");
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
}

/**
 * Admin-only: Update a user's role
 */
export async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["admin", "author", "user"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Allowed: admin, author, user" });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User role updated successfully",
      user,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update role", error: error.message });
  }
}

/**
 * Admin-only: Delete a user
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Clean up sessions
    await Session.deleteMany({ userId: id });

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
}
