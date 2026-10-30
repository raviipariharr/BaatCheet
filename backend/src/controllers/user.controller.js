import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import { parseLanguages } from "../lib/languages.js";
import { scoreMatch } from "../lib/matching.js";
import mongoose from "mongoose";
import sharp from "sharp";

export async function getRecommendedUsers(req, res) {
  try {
    const me = req.user;

    const candidates = await User.find({
      _id: { $ne: me._id, $nin: me.friends },
      isOnboarded: true,
    })
      .select("-password -email")
      .lean();

    const ranked = candidates
      .map((u) => ({ ...u, match: scoreMatch(me, u) }))
      .sort((a, b) => b.match.score - a.match.score);

    res.status(200).json(ranked);
  } catch (error) {
    console.error("Error in getRecommendedUsers controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMyFriends(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .select("friends")
      .populate("friends", "fullName profilePic nativeLanguage learningLanguage");

    res.status(200).json(user.friends);
  } catch (error) {
    console.error("Error in getMyFriends controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function sendFriendRequest(req, res) {
  try {
    const myId = req.user.id;
    const { id: recipientId } = req.params;

    // prevent sending req to yourself
    if (myId === recipientId) {
      return res.status(400).json({ message: "You can't send friend request to yourself" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    // check if user is already friends
    if (recipient.friends.includes(myId)) {
      return res.status(400).json({ message: "You are already friends with this user" });
    }

    // check if a req already exists
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: myId, recipient: recipientId },
        { sender: recipientId, recipient: myId },
      ],
    });

    if (existingRequest) {
      return res
        .status(400)
        .json({ message: "A friend request already exists between you and this user" });
    }

    const friendRequest = await FriendRequest.create({
      sender: myId,
      recipient: recipientId,
    });

    res.status(201).json(friendRequest);
  } catch (error) {
    console.error("Error in sendFriendRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function acceptFriendRequest(req, res) {
  try {
    const { id: requestId } = req.params;

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    // Verify the current user is the recipient
    if (friendRequest.recipient.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to accept this request" });
    }

    friendRequest.status = "accepted";
    await friendRequest.save();

    // add each user to the other's friends array
    // $addToSet: adds elements to an array only if they do not already exist.
    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: friendRequest.recipient },
    });

    await User.findByIdAndUpdate(friendRequest.recipient, {
      $addToSet: { friends: friendRequest.sender },
    });

    res.status(200).json({ message: "Friend request accepted" });
  } catch (error) {
    console.log("Error in acceptFriendRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getFriendRequests(req, res) {
  try {
    const incomingReqs = await FriendRequest.find({
      recipient: req.user.id,
      status: "pending",
    }).populate("sender", "fullName profilePic nativeLanguage learningLanguage");

    const acceptedReqs = await FriendRequest.find({
      sender: req.user.id,
      status: "accepted",
    }).populate("recipient", "fullName profilePic");

    res.status(200).json({ incomingReqs, acceptedReqs });
  } catch (error) {
    console.log("Error in getPendingFriendRequests controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getOutgoingFriendReqs(req, res) {
  try {
    const outgoingRequests = await FriendRequest.find({
      sender: req.user.id,
      status: "pending",
    }).populate("recipient", "fullName profilePic nativeLanguage learningLanguage");

    res.status(200).json(outgoingRequests);
  } catch (error) {
    console.log("Error in getOutgoingFriendReqs controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function updateLanguages(req, res) {
  try {
    const langs = parseLanguages(req.body);
    if (langs.error) return res.status(400).json({ message: langs.error });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: langs.data },
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error in updateLanguages controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function updateProfile(req, res) {
  try {
    const bio = typeof req.body.bio === "string" ? req.body.bio.trim() : "";
    if (!bio) return res.status(400).json({ message: "Bio can't be empty" });
    if (bio.length > 200) {
      return res.status(400).json({ message: "Bio must be 200 characters or fewer" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { bio } },
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error in updateProfile controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function updateAvatar(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });

    let buffer;
    try {
      buffer = await sharp(req.file.buffer, { limitInputPixels: 40_000_000 })
        .rotate() // respect phone orientation
        .resize(256, 256, { fit: "cover" })
        .jpeg({ quality: 80 }) // re-encoding also strips EXIF
        .toBuffer();
    } catch {
      return res.status(400).json({ message: "That file is not a valid image" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        avatarData: buffer,
        // ?v= changes on every upload so browsers don't show the old photo
        profilePic: `/api/users/${req.user.id}/avatar?v=${Date.now()}`,
      },
      { new: true }
    ).select("-password");

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error in updateAvatar controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getAvatar(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).end();

    const user = await User.findById(id).select("+avatarData");
    if (!user?.avatarData?.length) return res.status(404).end();

    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "private, max-age=31536000, immutable"); // safe: the URL changes with each upload
    res.send(user.avatarData);
  } catch (error) {
    console.error("Error in getAvatar controller", error.message);
    res.status(500).end();
  }
}