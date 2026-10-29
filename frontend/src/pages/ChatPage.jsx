import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";
import { SendIcon, SmileIcon } from "lucide-react";
import toast from "react-hot-toast";

import useAuthUser from "../hooks/useAuthUser";
import { useSocket } from "../context/SocketContext";
import { getMessages, getUserFriends } from "../lib/api";
import TranslateBlock from "../components/TranslateBlock";
import ChatLoader from "../components/ChatLoader";

const ChatPage = () => {
const { id: targetUserId } = useParams();
const { authUser } = useAuthUser();

const {
socket,
connected,
onlineUsers,
markRead,
setActiveChat,
} = useSocket();

const queryClient = useQueryClient();

const [text, setText] = useState("");
const [showEmoji, setShowEmoji] = useState(false);
const [peerTyping, setPeerTyping] = useState(false);

const inputRef = useRef(null);
const bottomRef = useRef(null);
const pickerRef = useRef(null);

const typingTimer = useRef(null);
const peerTypingTimer = useRef(null);
const iAmTyping = useRef(false);

const isTouch = () =>
typeof window !== "undefined" &&
window.matchMedia("(pointer: coarse)").matches;

// Fetch friends
const { data: friends = [] } = useQuery({
queryKey: ["friends"],
queryFn: getUserFriends,
});

const friend = friends.find((f) => f._id === targetUserId);

// Fetch conversation messages
const {
data: messages = [],
isLoading,
isError,
} = useQuery({
queryKey: ["messages", targetUserId],
queryFn: () => getMessages(targetUserId),
});

// Set active chat and mark messages as read.
// Keep this effect above conditional returns to preserve hook order.
useEffect(() => {
if (!targetUserId) return;
setActiveChat(targetUserId);
markRead(targetUserId);

const onVisible = () => {
  if (document.visibilityState === "visible") {
    markRead(targetUserId);
  }
};

document.addEventListener("visibilitychange", onVisible);

return () => {
  setActiveChat(null);
  document.removeEventListener("visibilitychange", onVisible);
};

}, [targetUserId, markRead, setActiveChat]);

// Close emoji picker when clicking or tapping outside.
useEffect(() => {
if (!showEmoji) return;
const close = (e) => {
  if (!pickerRef.current?.contains(e.target)) {
    setShowEmoji(false);
  }
};

document.addEventListener("pointerdown", close);

return () => {
  document.removeEventListener("pointerdown", close);
};

}, [showEmoji]);

// Handle incoming messages and typing indicators.
useEffect(() => {
if (!socket) return;
setPeerTyping(false);

const onNew = (msg) => {
  if (
    msg.sender !== targetUserId &&
    msg.recipient !== targetUserId
  ) {
    return;
  }

  queryClient.setQueryData(
    ["messages", targetUserId],
    (old = []) =>
      old.some((m) => m._id === msg._id)
        ? old
        : [...old, msg]
  );

  if (msg.sender === targetUserId) {
    setPeerTyping(false);
  }
};

const onTyping = ({ from, isTyping }) => {
  if (from !== targetUserId) return;

  setPeerTyping(isTyping);

  clearTimeout(peerTypingTimer.current);

  // Prevent the typing indicator from remaining visible indefinitely.
  if (isTyping) {
    peerTypingTimer.current = setTimeout(
      () => setPeerTyping(false),
      5000
    );
  }
};

socket.on("message:new", onNew);
socket.on("typing", onTyping);

return () => {
  socket.off("message:new", onNew);
  socket.off("typing", onTyping);
  clearTimeout(peerTypingTimer.current);
};
}, [socket, targetUserId, queryClient]);

// Scroll to the latest message.
useEffect(() => {
bottomRef.current?.scrollIntoView({
behavior: "smooth",
});
}, [messages.length, peerTyping]);

// Stop sending typing events after inactivity.
const stopTyping = () => {
clearTimeout(typingTimer.current);

if (iAmTyping.current) {
  socket?.emit("typing", {
    to: targetUserId,
    isTyping: false,
  });

  iAmTyping.current = false;
}
};

// Stop typing when leaving or changing conversations.
useEffect(() => {
return () => {
clearTimeout(typingTimer.current);
clearTimeout(peerTypingTimer.current);

  if (iAmTyping.current) {
    socket?.emit("typing", {
      to: targetUserId,
      isTyping: false,
    });

    iAmTyping.current = false;
  }
};

}, [targetUserId, socket]);

// Handle message input changes and typing indicators.
const handleChange = (e) => {
setText(e.target.value);

if (!iAmTyping.current) {
  socket?.emit("typing", {
    to: targetUserId,
    isTyping: true,
  });

  iAmTyping.current = true;
}

clearTimeout(typingTimer.current);
typingTimer.current = setTimeout(stopTyping, 2000);

};

// Send a message.
const handleSend = (e) => {
e.preventDefault();

const clean = text.trim();

if (!clean || !socket || !connected) return;

stopTyping();
setText("");
setShowEmoji(false);

socket
  .timeout(5000)
  .emit(
    "message:send",
    {
      to: targetUserId,
      text: clean,
    },
    (err, res) => {
      if (err || !res?.ok) {
        setText(clean);

        toast.error(
          res?.message || "Could not send message"
        );
      }
    }
  );

};
// Open or close the emoji picker.
const toggleEmoji = () => {
if (isTouch()) {
inputRef.current?.blur();
}

setShowEmoji((s) => !s);

};

// Insert an emoji at the current cursor position.
const insertEmoji = ({ emoji }) => {
const el = inputRef.current;

const start = el?.selectionStart ?? text.length;
const end = el?.selectionEnd ?? text.length;

setText(
  text.slice(0, start) +
    emoji +
    text.slice(end)
);

// On touch devices, do not reopen the keyboard automatically.
if (!isTouch()) {
  requestAnimationFrame(() => {
    el?.focus();

    el?.setSelectionRange(
      start + emoji.length,
      start + emoji.length
    );
  });
}

};

// Conditional rendering comes after all hooks.
if (isLoading) {
return <ChatLoader />;
}

if (isError) {
return ( <div className="p-8 text-center"> <p className="mb-4">
You can only chat with your friends. </p>

    <Link to="/" className="btn btn-primary btn-sm">
      Go home
    </Link>
  </div>
);
}
1
const isOnline = onlineUsers.has(targetUserId);

return ( <div className="flex flex-col h-[calc(100dvh-4rem)] max-w-4xl mx-auto">
{/* HEADER */} <div className="flex items-center gap-3 p-4 border-b border-base-300">
<div
className={`avatar ${isOnline ? "online" : "offline"}`}
> <div className="w-10 rounded-full"> <img
           src={friend?.profilePic}
           alt={friend?.fullName}
         /> </div> </div>

    <div>
      <h2 className="font-semibold leading-tight">
        {friend?.fullName ?? "Chat"}
      </h2>

      <p className="text-xs opacity-70">
        {isOnline ? "Online" : "Offline"}
      </p>
    </div>
  </div>

  {/* MESSAGES */}
  <div className="flex-1 overflow-y-auto p-4 space-y-3">
    {messages.length === 0 && (
      <p className="text-center opacity-60 mt-10">
        No messages yet. Say hello 👋
      </p>
    )}

    {messages.map((m) => {
      const mine = m.sender === authUser._id;

      return (
        <div
          key={m._id}
          className={`flex flex-col ${
            mine ? "items-end" : "items-start"
          }`}
        >
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-2 whitespace-pre-wrap break-words ${
              mine
                ? "bg-primary text-primary-content"
                : "bg-base-300"
            }`}
          >
            {m.text}
          </div>

          <span className="mt-1 text-[11px] opacity-60">
            {new Date(m.createdAt).toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            )}
          </span>

          {!mine && <TranslateBlock message={m} />}
        </div>
      );
    })}

    {peerTyping && (
      <div className="flex">
        <div className="bg-base-300 rounded-2xl px-4 py-2">
          <span className="loading loading-dots loading-sm" />
        </div>
      </div>
    )}

    <div ref={bottomRef} />
  </div>

  {/* INPUT */}
  <form
    onSubmit={handleSend}
    className="relative p-3 border-t border-base-300 flex items-center gap-2"
  >
    {/* RESPONSIVE EMOJI PICKER */}
    <div ref={pickerRef} className="contents">
      {showEmoji && (
        <div className="absolute bottom-full left-0 right-0 z-20 sm:left-3 sm:right-auto sm:w-[350px]">
          <EmojiPicker
            onEmojiClick={insertEmoji}
            emojiStyle={EmojiStyle.NATIVE}
            width="100%"
            height={320}
            lazyLoadEmojis
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
            theme="auto"
          />
        </div>
      )}

      <button
        type="button"
        className="btn btn-ghost btn-circle"
        onClick={toggleEmoji}
        aria-label="Toggle emoji picker"
        aria-expanded={showEmoji}
      >
        <SmileIcon className="size-6" />
      </button>
    </div>

    {/* MESSAGE INPUT */}
    <input
      ref={inputRef}
      className="input input-bordered flex-1 min-w-0"
      value={text}
      onChange={handleChange}
      placeholder={
        connected
          ? "Type a message"
          : "Reconnecting..."
      }
      maxLength={2000}
      disabled={!connected}
    />
    {/* SEND BUTTON */}
    <button
      type="submit"
      className="btn btn-primary btn-circle"
      disabled={!text.trim() || !connected}
      aria-label="Send message"
    >
      <SendIcon className="size-5" />
    </button>
   </form>
    </div>
  );
};
export default ChatPage;
