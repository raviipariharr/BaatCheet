
import express from "express";
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

// Apply authentication middleware to all routes
router.use(protectRoute);
router.get("/friends", getMyFriends);
router.put("/me/languages", updateLanguages);
router.get("/", getRecommendedUsers);
router.post("/friend-request/:id", sendFriendRequest);
router.put("/friend-request/:id/accept", acceptFriendRequest);
router.get("/friend-requests", getFriendRequests);
router.get("/outgoing-friend-requests", getOutgoingFriendReqs);

export default router;