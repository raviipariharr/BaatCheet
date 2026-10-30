import express from "express";
import rateLimit from "express-rate-limit";

import { protectRoute } from "../middleware/auth.middleware.js";

import {
getMessages,
getUnreadCounts,
translateMessage,
} from "../controllers/chat.controller.js";

const router = express.Router();

// Rate limiter for translation requests: 30 requests per minute
const translateLimiter = rateLimit({
windowMs: 60 * 1000,
limit: 30,
});

// Get unread message counts
router.get("/unread", protectRoute, getUnreadCounts);

// Get messages for a conversation
router.get("/messages/:userId", protectRoute, getMessages);

// Translate a message
router.post("/translate", protectRoute, translateLimiter, translateMessage);

export default router;
