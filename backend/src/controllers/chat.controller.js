import mongoose from "mongoose";
import Message from "../models/Message.js";
import { generateStreamToken } from "../lib/stream.js"; // delete in phase 4
import { conversationId } from "../lib/conversation.js";
import { translateText, TranslationError } from "../lib/translate.js";
import { cached } from "../lib/cache.js";

export async function getStreamToken(req, res) {
  try {
    const token = generateStreamToken(req.user.id);
    res.status(200).json({ token });
  } catch (error) {
    console.log("Error in getStreamToken controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMessages(req, res) {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    if (!req.user.friends.some((f) => f.toString() === userId)) {
      return res.status(403).json({ message: "You can only view chats with your friends" });
    }

    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const query = { conversationId: conversationId(req.user.id, userId) };
    if (req.query.before) query.createdAt = { $lt: new Date(req.query.before) };

    const messages = await Message.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    res.status(200).json(messages.reverse());
  } catch (error) {
    console.error("Error in getMessages controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// { "<senderId>": <count>, ... }
export async function getUnreadCounts(req, res) {
  try {
    const rows = await Message.aggregate([
      { $match: { recipient: new mongoose.Types.ObjectId(req.user.id), readAt: null } },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
    ]);
    res.status(200).json(Object.fromEntries(rows.map((r) => [r._id.toString(), r.count])));
  } catch (error) {
    console.error("Error in getUnreadCounts controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function translateMessage(req, res) {
  try {
    const { messageId } = req.body;
    if (typeof messageId !== "string" || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid messageId" });
    }

    const target = req.user.nativeLanguage;
    if (!target) {
      return res.status(400).json({ message: "Set your native language in your profile first" });
    }

    const message = await Message.findById(messageId).lean();
    if (!message) return res.status(404).json({ message: "Message not found" });

    const isParticipant = [message.sender, message.recipient].some(
      (id) => id.toString() === req.user.id
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "You can't translate this message" });
    }

    const key = `${message._id}:${target}`; // messages can't be edited
    const { translatedText, sameLanguage } = await cached(key, () =>
      translateText(message.text, target)
    );

    res.status(200).json({ translatedText, targetLanguage: target, sameLanguage });
  } catch (error) {
    if (error instanceof TranslationError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Error in translateMessage controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}