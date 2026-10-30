import { useEffect, useRef } from "react";
import { MicIcon, MicOffIcon, PhoneIcon, PhoneOffIcon, VideoIcon, VideoOffIcon } from "lucide-react";
import { useCall } from "../context/CallContext";

const VideoEl = ({ stream, muted = false, className = "", style }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} style={style} />;
};

const CallOverlay = () => {
  const { call, localStream, remoteStream, micOn, camOn, acceptCall, hangup, toggleMic, toggleCam } = useCall();
  if (call.status === "idle") return null;
  const peer = call.peer || {};

  if (call.status === "incoming") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="card bg-base-100 w-full max-w-sm shadow-2xl">
          <div className="card-body items-center text-center gap-3">
            <div className="avatar">
              <div className="w-24 rounded-full">
                <img src={peer.profilePic} alt={peer.name} />
              </div>
            </div>
            <h3 className="text-xl font-semibold">{peer.name}</h3>
            <p className="opacity-70">Incoming video call...</p>
            <div className="flex gap-6 mt-2">
              <button className="btn btn-error btn-circle btn-lg" onClick={hangup} aria-label="Decline">
                <PhoneOffIcon />
              </button>
              <button className="btn btn-success btn-circle btn-lg text-white" onClick={acceptCall} aria-label="Accept">
                <PhoneIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const connected = call.status === "active";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative flex-1 min-h-0">
        {connected ? (
          <VideoEl stream={remoteStream} className="size-full object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="avatar">
              <div className="w-24 rounded-full">
                <img src={peer.profilePic} alt={peer.name} />
              </div>
            </div>
            <p className="text-lg">{call.status === "calling" ? `Calling ${peer.name}...` : "Connecting..."}</p>
          </div>
        )}

        {localStream && camOn && (
          <VideoEl
            stream={localStream}
            muted
            style={{ transform: "scaleX(-1)" }}
            className="absolute bottom-4 right-4 w-28 sm:w-44 aspect-[3/4] sm:aspect-video rounded-lg object-cover bg-neutral border border-white/20"
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button className={`btn btn-circle ${micOn ? "btn-neutral" : "btn-warning"}`} onClick={toggleMic} aria-label="Toggle microphone">
          {micOn ? <MicIcon className="size-5" /> : <MicOffIcon className="size-5" />}
        </button>
        <button className={`btn btn-circle ${camOn ? "btn-neutral" : "btn-warning"}`} onClick={toggleCam} aria-label="Toggle camera">
          {camOn ? <VideoIcon className="size-5" /> : <VideoOffIcon className="size-5" />}
        </button>
        <button className="btn btn-error btn-circle btn-lg" onClick={hangup} aria-label="Hang up">
          <PhoneOffIcon />
        </button>
      </div>
    </div>
  );
};

export default CallOverlay;