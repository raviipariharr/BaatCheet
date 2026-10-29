import { generateStreamToken } from "../lib/stream.js";
import { streamClient } from "../lib/stream.js";
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

export async function translateMessage(req, res) {
  try {
    const { messageId } = req.body;
    if (!messageId || typeof messageId !== "string") {
      return res.status(400).json({ message: "messageId is required" });
    }

    const target = req.user.nativeLanguage;
    if (!target) {
      return res.status(400).json({ message: "Set your native language in your profile first" });
    }

    const { message } = await streamClient.getMessage(messageId);

    // the requester must be a member of the channel this message belongs to
    const [type, id] = message.cid.split(":");
    const { members } = await streamClient.channel(type, id).queryMembers({ id: req.user.id });
    if (members.length === 0) {
      return res.status(403).json({ message: "You can't translate this message" });
    }

    const text = message.text?.trim();
    if (!text) {
      return res.status(400).json({ message: "This message has no text to translate" });
    }

    // updated_at in the key means an edited message is translated again
    const key = `${message.id}:${message.updated_at}:${target}`;
    const { translatedText, sameLanguage } = await cached(key, () => translateText(text, target));

    res.status(200).json({ translatedText, targetLanguage: target, sameLanguage });
  } catch (error) {
    if (error instanceof TranslationError) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error.status === 404) {
      return res.status(404).json({ message: "Message not found" });
    }
    console.error("Error in translateMessage controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}