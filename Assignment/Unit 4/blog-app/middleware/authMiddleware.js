import Session from "../models/Session.js";
import User from "../models/User.js";

/**
 * Authentication middleware
 * Verifies the user is logged in via signed session cookie.
 * Attaches the full user document to req.user.
 */
async function authMiddleware(req, res, next) {
  try {
    const sessionId = req.signedCookies.sid;

    if (!sessionId) {
      return res.status(401).json({ message: "Please login first" });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(401).json({ message: "Session not found. Please login again." });
    }

    if (session.expiresAt < Date.now()) {
      await Session.findByIdAndDelete(session._id);
      return res.status(401).json({ message: "Session expired. Please login again." });
    }

    const user = await User.findById(session.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Invalid session. User not found." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ message: "Authentication error", error: error.message });
  }
}

export default authMiddleware;
