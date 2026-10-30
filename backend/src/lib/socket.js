import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Message from "../models/Message.js";
import { conversationId } from "./conversation.js";


const online = new Map();
// Parse a cookie header without an external package.
function parseCookie(cookieHeader, name) {
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

const calls = new Map();

function endCall(io, userId, reason) {
  const st = calls.get(userId);
  if (!st) return;

  const peerId = st.peer;

  clearTimeout(st.timer);
  clearTimeout(calls.get(peerId)?.timer);

  calls.delete(userId);
  calls.delete(peerId);

  io.to([`user:${userId}`, `user:${peerId}`]).emit("call:ended", {
    reason,
    by: userId,
  });
}

const areFriends = (a, b) => User.exists({ _id: a, friends: b });

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // Authenticate using the JWT cookie.
  io.use(async (socket, next) => {
    try {
      const token = parseCookie(
        socket.handshake.headers.cookie || "",
        "jwt"
      );

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

      const user = await User.findById(decoded.userId).select("_id friends");

      if (!user) {
        return next(new Error("Unauthorized"));
      }

      socket.user = user;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const me = socket.user._id.toString();
    const friendIds = socket.user.friends.map(String);

    socket.join(`user:${me}`);

    const sockets = online.get(me) ?? new Set();
    sockets.add(socket.id);
    online.set(me, sockets);

    // Send the current online status of friends.
    socket.emit(
      "presence:init",
      friendIds.filter((id) => online.has(id))
    );

    // Notify friends when the user comes online.
    if (sockets.size === 1) {
      friendIds.forEach((id) => {
        io.to(`user:${id}`).emit("presence:update", {
          userId: me,
          online: true,
        });
      });
    }

    // Typing indicator.
    socket.on("typing", async ({ to, isTyping } = {}) => {
      try {
        if (!mongoose.isValidObjectId(to)) return;
        if (!(await areFriends(me, to))) return;

        io.to(`user:${to}`).emit("typing", {
          from: me,
          isTyping: Boolean(isTyping),
        });
      } catch (error) {
        console.error("typing error:", error.message);
      }
    });

    // Send a message.
    socket.on("message:send", async ({ to, text } = {}, ack) => {
      try {
        if (!mongoose.isValidObjectId(to)) {
          return ack?.({
            ok: false,
            message: "Invalid recipient",
          });
        }

        const clean = typeof text === "string" ? text.trim() : "";

        if (!clean || clean.length > 2000) {
          return ack?.({
            ok: false,
            message: "Message must be 1-2000 characters",
          });
        }

        if (!(await areFriends(me, to))) {
          return ack?.({
            ok: false,
            message: "You can only message your friends",
          });
        }

        const msg = await Message.create({
          conversationId: conversationId(me, to),
          sender: me,
          recipient: to,
          text: clean,
        });

        // Deliver to both users across all their tabs.
        io.to([`user:${me}`, `user:${to}`]).emit("message:new", msg);

        ack?.({ ok: true });
      } catch (error) {
        console.error("message:send error:", error.message);

        ack?.({
          ok: false,
          message: "Could not send message",
        });
      }
    });

    // Handle disconnection.
    socket.on("disconnect", () => {
      sockets.delete(socket.id);

      const st = calls.get(me);
      if (st && (st.socketId === socket.id || sockets.size === 0)) {
        endCall(io, me, st.status === "ringing" && st.role === "caller" ? "cancelled" : "disconnected");
      }
      if (sockets.size === 0) {
        online.delete(me);

        friendIds.forEach((id) => {
          io.to(`user:${id}`).emit("presence:update", {
            userId: me,
            online: false,
          });
        });
      }
    });

    socket.on("chat:read", async ({ from } = {}) => {
      if (!mongoose.isValidObjectId(from)) return;
      await Message.updateMany(
        { sender: from, recipient: me, readAt: null },
        { $set: { readAt: new Date() } }
      );
      // other tabs of mine clear their badge too
      io.to(`user:${me}`).emit("unread:cleared", { from });
    });

    socket.on("message:delete", async ({ messageId } = {}, ack) => {
      try {
        if (!mongoose.isValidObjectId(messageId)) {
          return ack?.({ ok: false, message: "Invalid message" });
        }

        // the sender filter makes "only my own messages" a single atomic check
        const msg = await Message.findOneAndDelete({ _id: messageId, sender: me });
        if (!msg) return ack?.({ ok: false, message: "Message not found" });

        io.to([`user:${me}`, `user:${msg.recipient}`]).emit("message:deleted", {
          messageId,
          sender: me,
          recipient: msg.recipient.toString(),
          wasUnread: !msg.readAt, // so the recipient's badge can go down
        });
        ack?.({ ok: true });
      } catch (error) {
        console.error("message:delete error:", error.message);
        ack?.({ ok: false, message: "Could not delete message" });
      }
    });

    socket.on("call:invite", async ({ to } = {}, ack) => {
      if (!mongoose.isValidObjectId(to) || !(await areFriends(me, to))) {
        return ack?.({ ok: false, message: "You can only call your friends" });
      }
      // no await between these checks and calls.set, so two invites can't race
      if (!online.has(to)) return ack?.({ ok: false, message: "They are offline" });
      if (calls.has(me)) return ack?.({ ok: false, message: "You are already in a call" });
      if (calls.has(to)) return ack?.({ ok: false, message: "They are busy on another call" });

      const timer = setTimeout(() => {
        if (calls.get(me)?.status === "ringing") {
          endCall(io, me, "timeout");
        }
      }, 30_000);

      calls.set(me, { peer: to, role: "caller", status: "ringing", socketId: socket.id, timer });
      calls.set(to, { peer: me, role: "callee", status: "ringing" });

      io.to(`user:${to}`).emit("call:incoming", {
        from: me,
        name: socket.user.fullName,
        profilePic: socket.user.profilePic,
      });
      ack?.({ ok: true });
    });

    socket.on("call:accept", () => {
      const st = calls.get(me);
      if (!st || st.role !== "callee" || st.status !== "ringing") return;
      const caller = calls.get(st.peer);
      if (!caller) return;

      clearTimeout(caller.timer);
      st.status = "active";
      st.socketId = socket.id; // the call now belongs to this tab
      caller.status = "active";

      socket.to(`user:${me}`).emit("call:handled"); // my other tabs stop ringing
      io.to(caller.socketId).emit("call:accepted");
    });

    // relays only between the two sockets that own the call
    socket.on("call:signal", ({ data } = {}) => {
      const st = calls.get(me);
      if (!st || st.status !== "active" || st.socketId !== socket.id) return;
      const peerSocketId = calls.get(st.peer)?.socketId;
      if (peerSocketId && data && typeof data === "object") {
        io.to(peerSocketId).emit("call:signal", { data });
      }
    });

    // cancel (caller), reject (callee) and hang up all use this
    socket.on("call:end", () => {
      const st = calls.get(me);
      if (!st) return;
      endCall(io, me, st.status === "active" ? "hangup" : st.role === "caller" ? "cancelled" : "rejected");
    });

  });

  return io;
}
