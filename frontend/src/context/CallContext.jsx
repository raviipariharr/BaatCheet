import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useSocket } from "./SocketContext";
import useLiveCaptions from "../hooks/useLiveCaptions";

const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    ...(import.meta.env.VITE_TURN_URL
        ? [{
            urls: import.meta.env.VITE_TURN_URL,
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
        }]
        : []),
];

async function getMedia() {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("unsupported"), { name: "NotSupportedError" });
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        return { stream, hasVideo: true };
    } catch (err) {
        if (err.name === "NotAllowedError" || err.name === "NotSupportedError") throw err;
        // camera missing or busy (another app is using it): continue with audio only
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return { stream, hasVideo: false };
    }
}

const mediaError = (err) =>
    err.name === "NotAllowedError"
        ? "Camera/microphone permission denied. Allow it in your browser settings."
        : err.name === "NotSupportedError"
            ? "Calls need HTTPS (or localhost)."
            : "Could not access your microphone.";

const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
    const { socket } = useSocket();

    const [call, setCall] = useState({ status: "idle" }); // idle | calling | incoming | connecting | active
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);

    const pcRef = useRef(null);
    const localRef = useRef(null);
    const pendingIce = useRef([]);
    const callRef = useRef(call);
    callRef.current = call;

    const live = useLiveCaptions({ socket, active: call.status === "active", micOn });
    
    const cleanup = useCallback(() => {
        pcRef.current?.close();
        pcRef.current = null;
        localRef.current?.getTracks().forEach((t) => t.stop());
        localRef.current = null;
        pendingIce.current = [];
        setLocalStream(null);
        setRemoteStream(null);
        setMicOn(true);
        setCamOn(true);
        setCall({ status: "idle" });
    }, []);

    const createPeer = useCallback(
        (stream) => {
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    socket.emit("call:signal", { data: { kind: "ice", candidate: e.candidate.toJSON() } });
                }
            };
            pc.ontrack = (e) => setRemoteStream(e.streams[0]);
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === "connected") setCall((c) => ({ ...c, status: "active" }));
                if (pc.connectionState === "failed") {
                    toast.error("Could not connect the call. Your network may block direct connections.");
                    socket.emit("call:end");
                    cleanup();
                }
            };

            pcRef.current = pc;
            return pc;
        },
        [socket, cleanup]
    );

    // ---- actions ----
    const startCall = useCallback(
        async (peer) => {
            if (!socket || callRef.current.status !== "idle") return;
            setCall({ status: "calling", role: "caller", peer });

            let media;
            try {
                media = await getMedia();
            } catch (err) {
                toast.error(mediaError(err));
                cleanup();
                return;
            }
            if (callRef.current.status !== "calling") {
                media.stream.getTracks().forEach((t) => t.stop()); // user cancelled during the permission prompt
                return;
            }

            localRef.current = media.stream;
            setLocalStream(media.stream);
            setCamOn(media.hasVideo);
            if (!media.hasVideo) toast("Camera unavailable. Calling with audio only.");

            socket.timeout(5000).emit("call:invite", { to: peer.id }, (err, res) => {
                if (err || !res?.ok) {
                    toast.error(res?.message || "Could not start the call");
                    cleanup();
                }
            });
        },
        [socket, cleanup]
    );

    const acceptCall = useCallback(async () => {
        if (!socket || callRef.current.status !== "incoming") return;

        let media;
        try {
            media = await getMedia();
        } catch (err) {
            toast.error(mediaError(err));
            socket.emit("call:end");
            cleanup();
            return;
        }
        if (callRef.current.status !== "incoming") {
            media.stream.getTracks().forEach((t) => t.stop()); // caller gave up while the prompt was open
            return;
        }

        localRef.current = media.stream;
        setLocalStream(media.stream);
        setCamOn(media.hasVideo);
        setCall((c) => ({ ...c, status: "connecting" }));
        createPeer(media.stream); // ready before the offer arrives
        socket.emit("call:accept");
    }, [socket, cleanup, createPeer]);

    // cancel / reject / hang up
    const hangup = useCallback(() => {
        socket?.emit("call:end");
        cleanup();
    }, [socket, cleanup]);

    const toggleMic = () => {
        const t = localRef.current?.getAudioTracks()[0];
        if (!t) return;
        t.enabled = !t.enabled;
        setMicOn(t.enabled);
    };

    const toggleCam = () => {
        const t = localRef.current?.getVideoTracks()[0];
        if (!t) return;
        t.enabled = !t.enabled;
        setCamOn(t.enabled);
    };

    // ---- socket events ----
    useEffect(() => {
        if (!socket) return;

        const onIncoming = ({ from, name, profilePic }) => {
            if (callRef.current.status !== "idle") return socket.emit("call:end"); // busy locally
            setCall({ status: "incoming", role: "callee", peer: { id: from, name, profilePic } });
        };

        const onAccepted = async () => {
            const stream = localRef.current;
            if (!stream) return;
            try {
                setCall((c) => ({ ...c, status: "connecting" }));
                const pc = createPeer(stream);
                // no camera? still ask to RECEIVE the other side's video
                if (stream.getVideoTracks().length === 0) pc.addTransceiver("video", { direction: "recvonly" });
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit("call:signal", {
                    data: { kind: "sdp", sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } },
                });
            } catch (err) {
                console.error("Offer error:", err);
                toast.error("Could not start the call");
                socket.emit("call:end");
                cleanup();
            }
        };

        const onSignal = async ({ data }) => {
            const pc = pcRef.current;
            if (!pc || !data) return;
            try {
                if (data.kind === "sdp") {
                    await pc.setRemoteDescription(data.sdp);
                    for (const c of pendingIce.current.splice(0)) await pc.addIceCandidate(c);
                    if (data.sdp.type === "offer") {
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        socket.emit("call:signal", {
                            data: { kind: "sdp", sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } },
                        });
                    }
                } else if (data.kind === "ice" && data.candidate) {
                    // candidates can arrive before the remote description; hold them until it is set
                    if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
                    else pendingIce.current.push(data.candidate);
                }
            } catch (err) {
                console.error("Signaling error:", err);
            }
        };

        const onEnded = ({ reason }) => {
            const c = callRef.current;
            if (c.status === "idle") return; // I ended it myself and already cleaned up
            const name = c.peer?.name || "They";
            const iAmCaller = c.role === "caller";

            if (reason === "rejected" && iAmCaller) toast(`${name} declined the call`);
            else if (reason === "timeout") toast(iAmCaller ? `${name} didn't answer` : `Missed call from ${name}`);
            else if (reason === "cancelled") toast(`Missed call from ${name}`);
            else if (reason === "hangup") toast("Call ended");
            else if (reason === "disconnected") toast.error("The call was disconnected");
            cleanup();
        };

        const onHandled = () => {
            if (callRef.current.status === "incoming") cleanup(); // answered on another tab
        };

        const onDisconnect = () => {
            if (callRef.current.status !== "idle") {
                toast.error("Connection lost");
                cleanup();
            }
        };

        socket.on("call:incoming", onIncoming);
        socket.on("call:accepted", onAccepted);
        socket.on("call:signal", onSignal);
        socket.on("call:ended", onEnded);
        socket.on("call:handled", onHandled);
        socket.on("disconnect", onDisconnect);
        return () => {
            socket.off("call:incoming", onIncoming);
            socket.off("call:accepted", onAccepted);
            socket.off("call:signal", onSignal);
            socket.off("call:ended", onEnded);
            socket.off("call:handled", onHandled);
            socket.off("disconnect", onDisconnect);
        };
    }, [socket, createPeer, cleanup]);

    // Build the context value after all referenced functions are initialized.
    const value = {
        call,
        localStream,
        remoteStream,
        micOn,
        camOn,
        startCall,
        acceptCall,
        hangup,
        toggleMic,
        toggleCam,
        ...live,
    };

    return (
        <CallContext.Provider value={value}>
            {children}
        </CallContext.Provider>
    );
};