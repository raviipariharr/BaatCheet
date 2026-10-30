import { useEffect, useRef } from "react";
import { useCall } from "../context/CallContext";
import {
    CaptionsIcon,
    MicIcon,
    MicOffIcon,
    PhoneIcon,
    PhoneOffIcon,
    VideoIcon,
    VideoOffIcon,
} from "lucide-react";
import useAuthUser from "../hooks/useAuthUser";
import { capitialize } from "../lib/utils";

const VideoEl = ({ stream, muted = false, className = "", style }) => {
    const ref = useRef(null);

    useEffect(() => {
        const video = ref.current;

        if (video) {
            video.srcObject = stream || null;
        }

        return () => {
            if (video) {
                video.srcObject = null;
            }
        };
    }, [stream]);

    return (
        <video
            ref={ref}
            autoPlay
            playsInline
            muted={muted}
            className={className}
            style={style}
        />
    );
};

const CallOverlay = () => {
    const {
        call,
        localStream,
        remoteStream,
        micOn,
        camOn,
        acceptCall,
        hangup,
        toggleMic,
        toggleCam,
        captionsOn,
        toggleCaptions,
        speakLang,
        setSpeakChoice,
        myLine,
        peerLines,
        packPrompt,
        downloadPack,
        translateIssue,
    } = useCall();

    // All hooks must run before conditional returns.
    const { authUser } = useAuthUser();

    if (call.status === "idle") return null;

    const peer = call.peer || {};
    const connected = call.status === "active";

    const speakOptions = [
        ...new Set(
            [
                authUser?.nativeLanguage,
                authUser?.learningLanguage,
                ...(authUser?.knownLanguages || []),
            ].filter(Boolean)
        ),
    ];

    // Incoming call screen
    if (call.status === "incoming") {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="card w-full max-w-sm bg-base-100 shadow-2xl">
                    <div className="card-body items-center gap-3 text-center">
                        <div className="avatar">
                            <div className="w-24 rounded-full">
                                <img
                                    src={peer.profilePic}
                                    alt={peer.name || "Caller"}
                                />
                            </div>
                        </div>

                        <h3 className="text-xl font-semibold">
                            {peer.name || "Unknown caller"}
                        </h3>

                        <p className="opacity-70">
                            Incoming video call...
                        </p>

                        <div className="mt-2 flex gap-6">
                            <button
                                className="btn btn-error btn-circle btn-lg"
                                onClick={hangup}
                                aria-label="Decline call"
                                title="Decline call"
                            >
                                <PhoneOffIcon />
                            </button>

                            <button
                                className="btn btn-success btn-circle btn-lg text-white"
                                onClick={acceptCall}
                                aria-label="Accept call"
                                title="Accept call"
                            >
                                <PhoneIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
            {/* Main video area */}
            <div className="relative min-h-0 flex-1">
                {connected ? (
                    <VideoEl
                        stream={remoteStream}
                        className="size-full object-contain"
                    />
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                        <div className="avatar">
                            <div className="w-24 rounded-full">
                                <img
                                    src={peer.profilePic}
                                    alt={peer.name || "Calling user"}
                                />
                            </div>
                        </div>

                        <p className="text-lg">
                            {call.status === "calling"
                                ? `Calling ${peer.name || "user"}...`
                                : "Connecting..."}
                        </p>
                    </div>
                )}

                {/* Local video preview */}
                {localStream && camOn && (
                    <VideoEl
                        stream={localStream}
                        muted
                        style={{ transform: "scaleX(-1)" }}
                        className="absolute bottom-4 right-4 aspect-[3/4] w-28 rounded-lg border border-white/20 bg-neutral object-cover sm:w-44 sm:aspect-video"
                    />
                )}

                {/* Live subtitles */}
                {connected && (
                    <>
                        <div className="pointer-events-none absolute inset-x-0 top-4 flex max-h-[45%] flex-col items-center gap-2 overflow-y-auto px-4">
                            {(peerLines || []).map((l) => (
                                <div
                                    key={l.id}
                                    className="max-w-[90%] rounded-lg bg-black/70 px-4 py-2 text-center shadow-lg"
                                >
                                    {l.translated ? (
                                        <>
                                            <p className="text-lg font-medium">
                                                {l.translated}
                                            </p>

                                            <p className="mt-1 text-xs opacity-60">
                                                {l.text}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-lg">{l.text}</p>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Your recognized speech */}
                        {captionsOn && myLine?.text && (
                            <p className="pointer-events-none absolute bottom-4 left-4 max-w-[55%] rounded bg-black/60 px-2 py-1 text-xs opacity-80">
                                You: {myLine.text}
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* Translation pack prompt */}
            {packPrompt && (
                <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-lg bg-white/10 p-3 text-sm">
                    <span>
                        {packPrompt.state === "downloading"
                            ? `Downloading translation pack... ${Math.round(
                                  (packPrompt.progress || 0) * 100
                              )}%`
                            : `Download the ${capitialize(
                                  packPrompt.lang
                              )} → ${capitialize(
                                  authUser?.nativeLanguage || "your language"
                              )} translation pack (one time) to see translated captions.`}
                    </span>

                    {packPrompt.state !== "downloading" && (
                        <button
                            className="btn btn-primary btn-sm shrink-0"
                            onClick={downloadPack}
                        >
                            Download
                        </button>
                    )}
                </div>
            )}

            {/* Translation status notice */}
            {!packPrompt && translateIssue && (
                <p className="mx-4 mb-2 text-center text-xs opacity-70">
                    {translateIssue === "browser"
                        ? "This browser can't translate live, so you only see original captions. Desktop Chrome or Edge is needed."
                        : "Live translation isn't available for this language pair. Showing original captions only."}
                </p>
            )}

            {/* Call controls */}
            <div className="flex flex-wrap items-center justify-center gap-4 bg-black/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {/* Microphone */}
                <button
                    className={`btn btn-circle ${
                        micOn ? "btn-neutral" : "btn-warning"
                    }`}
                    onClick={toggleMic}
                    aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
                    title={micOn ? "Mute microphone" : "Unmute microphone"}
                >
                    {micOn ? (
                        <MicIcon className="size-5" />
                    ) : (
                        <MicOffIcon className="size-5" />
                    )}
                </button>

                {/* Camera */}
                <button
                    className={`btn btn-circle ${
                        camOn ? "btn-neutral" : "btn-warning"
                    }`}
                    onClick={toggleCam}
                    aria-label={camOn ? "Turn camera off" : "Turn camera on"}
                    title={camOn ? "Turn camera off" : "Turn camera on"}
                >
                    {camOn ? (
                        <VideoIcon className="size-5" />
                    ) : (
                        <VideoOffIcon className="size-5" />
                    )}
                </button>

                {/* Captions toggle */}
                <button
                    className={`btn btn-circle ${
                        captionsOn ? "btn-primary" : "btn-neutral"
                    }`}
                    onClick={toggleCaptions}
                    aria-label="Toggle live captions"
                    title="Live captions"
                >
                    <CaptionsIcon className="size-5" />
                </button>

                {/* Speaking language selector */}
                {captionsOn && speakOptions.length > 0 && (
                    <select
                        className="select select-sm select-bordered max-w-[8rem] text-base-content"
                        value={speakLang || ""}
                        onChange={(e) => setSpeakChoice(e.target.value)}
                        aria-label="Language I am speaking"
                    >
                        {speakOptions.map((l) => (
                            <option key={l} value={l}>
                                {capitialize(l)}
                            </option>
                        ))}
                    </select>
                )}

                {/* Hang-up button */}
                <button
                    className="btn btn-error btn-circle btn-lg"
                    onClick={hangup}
                    aria-label="Hang up"
                    title="End call"
                >
                    <PhoneOffIcon />
                </button>
            </div>
        </div>
    );
};

export default CallOverlay;