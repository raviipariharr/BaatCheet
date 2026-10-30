import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import useAuthUser from "../hooks/useAuthUser";
import { getUnreadCounts } from "../lib/api";

const SOCKET_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : undefined;

const SocketContext = createContext({
  socket: null,
  connected: false,
  onlineUsers: new Set(),
  unread: {},
  totalUnread: 0,
  markRead: () => { },
  setActiveChat: () => { },
});
export const useSocket = () => useContext(SocketContext);

const withoutKey = (obj, key) => {
  if (!obj[key]) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
};

export const SocketProvider = ({ children }) => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unread, setUnread] = useState({});
  const activeChatRef = useRef(null); // which chat is open right now

  const setActiveChat = useCallback((id) => {
    activeChatRef.current = id;
  }, []);

  const markRead = useCallback(
    (userId) => {
      setUnread((prev) => withoutKey(prev, userId));
      socket?.emit("chat:read", { from: userId });
    },
    [socket]
  );

  useEffect(() => {
    if (!authUser?._id) return;
    const myId = authUser._id;

    const s = io(SOCKET_URL, { withCredentials: true });
    setSocket(s);

    s.on("connect", async () => {
      setConnected(true);
      // catch up on anything missed while offline or reconnecting
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      try {
        const counts = await getUnreadCounts();
        const active = activeChatRef.current;
        if (active && counts[active] && document.visibilityState === "visible") {
          delete counts[active];
          s.emit("chat:read", { from: active });
        }
        setUnread(counts);
      } catch {
        /* badges stay as they were */
      }
    });
    s.on("disconnect", () => setConnected(false));

    s.on("presence:init", (ids) => setOnlineUsers(new Set(ids)));
    s.on("presence:update", ({ userId, online }) =>
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      })
    );

    s.on("message:new", (msg) => {
      if (msg.recipient !== myId) return; // my own sent messages don't count
      if (activeChatRef.current === msg.sender && document.visibilityState === "visible") {
        s.emit("chat:read", { from: msg.sender }); // I'm looking at it
      } else {
        setUnread((prev) => ({ ...prev, [msg.sender]: (prev[msg.sender] || 0) + 1 }));
      }
    });

    s.on("unread:cleared", ({ from }) => setUnread((prev) => withoutKey(prev, from)));

    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setOnlineUsers(new Set());
      setUnread({});
    };
  }, [authUser?._id, queryClient]);

  const totalUnread = useMemo(() => Object.values(unread).reduce((a, b) => a + b, 0), [unread]);

  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) BaatCheet` : "BaatCheet";
  }, [totalUnread]);

  return (
    <SocketContext.Provider
      value={{ socket, connected, onlineUsers, unread, totalUnread, markRead, setActiveChat }}
    >
      {children}
    </SocketContext.Provider>
  );
};