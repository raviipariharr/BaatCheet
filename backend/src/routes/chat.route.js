import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";

import {
  getStreamToken,
  getMessages,
  translateMessage,
} from "../controllers/chat.controller.js";

import rateLimit from "express-rate-limit";

const router = express.Router();

// Get Stream token
router.get("/token", protectRoute, getStreamToken);

// Get messages for a conversation
router.get("/messages/:userId", protectRoute, getMessages);

// Rate limiter for translation requests: 30 requests per minute
const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
});

router.post(
  "/translate",
  protectRoute,
  translateLimiter,
  translateMessage
);

export default router;