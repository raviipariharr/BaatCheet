
import express from "express";
import multer from "multer";
import { /* ...existing */ updateProfile, updateAvatar, getAvatar } from "../controllers/user.controller.js";
import {
  getRecommendedUsers,
  getMyFriends,
  sendFriendRequest,
  acceptFriendRequest,
  getFriendRequests,
  getOutgoingFriendReqs,
  updateLanguages,
} from "../controllers/user.controller.js";

import { protectRoute } from "../middleware/auth.middleware.js";
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadAvatar = (req, res, next) =>
  upload.single("avatar")(req, res, (err) => {
    if (!err) return next();
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    res.status(tooBig ? 413 : 400).json({ message: tooBig ? "Image must be under 10 MB" : "Upload failed" });
  });

// Apply authentication middleware to all routes
router.use(protectRoute);
router.get("/friends", getMyFriends);
router.put("/me/languages", updateLanguages);
router.get("/", getRecommendedUsers);
router.get("/:id/avatar", getAvatar);
router.put("/me/profile", updateProfile);
router.put("/me/avatar", uploadAvatar, updateAvatar);
router.post("/friend-request/:id", sendFriendRequest);
router.put("/friend-request/:id/accept", acceptFriendRequest);
router.get("/friend-requests", getFriendRequests);
router.get("/outgoing-friend-requests", getOutgoingFriendReqs);

export default router;