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
  });

  return io;
}
