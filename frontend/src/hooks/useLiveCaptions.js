import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import useAuthUser from "./useAuthUser";
import { LANG_CODES, SPEECH_LOCALES, getTranslator, packStatus } from "../lib/liveTranslate";

const useLiveCaptions = ({ socket, active, micOn }) => {
  const { authUser } = useAuthUser();
  const myLang = authUser?.nativeLanguage;
  const myLangRef = useRef(myLang);
  myLangRef.current = myLang;

  const [captionsOn, setCaptionsOn] = useState(false);
  const [speakChoice, setSpeakChoice] = useState(null);
  const [myLine, setMyLine] = useState(null);
  const [peerLines, setPeerLines] = useState([]); // the last 2 lines the other person said
  const [packPrompt, setPackPrompt] = useState(null);
  const [translateIssue, setTranslateIssue] = useState(null); // "browser" | "pair" | null
  const timers = useRef({});

  const speakLang = speakChoice || myLang || "english";

  const showMine = useCallback((line) => {
    setMyLine(line);
    clearTimeout(timers.current.me);
    timers.current.me = setTimeout(() => setMyLine(null), 4000);
  }, []);

  // merge by id, so the final text and its translation update the same line
  const upsertPeer = useCallback((part) => {
    setPeerLines((prev) => {
      const i = prev.findIndex((l) => l.id === part.id);
      const next = i >= 0 ? prev.map((l, k) => (k === i ? { ...l, ...part } : l)) : [...prev, part];
      return next.slice(-2);
    });
    clearTimeout(timers.current.peer);
    timers.current.peer = setTimeout(() => setPeerLines([]), 7000);
  }, []);

  // reset everything when the call is not active
  useEffect(() => {
    if (active) return;
    setCaptionsOn(false);
    setMyLine(null);
    setPeerLines([]);
    setPackPrompt(null);
    setTranslateIssue(null);
    Object.values(timers.current).forEach(clearTimeout);
  }, [active]);

  // ---- SENDING: recognize my speech and send the text ----
  useEffect(() => {
    // muted means no recognition: the recognizer has its own microphone access and would keep listening
    if (!captionsOn || !active || !micOn || !socket) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition isn't supported in this browser. Use Chrome, Edge or Safari.");
      setCaptionsOn(false);
      return;
    }

    let stopped = false;
    let session = 0;
    let lastSent = 0;

    const rec = new SR();
    rec.lang = SPEECH_LOCALES[speakLang];
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (!text) continue;

        const final = r.isFinal;
        const now = Date.now();
        if (!final && now - lastSent < 350) continue; // throttle the live (interim) updates
        lastSent = now;

        const line = { id: `${session}.${i}`, text: text.slice(0, 500), lang: speakLang, final };
        socket.emit("call:caption", line);
        showMine(line);
      }
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // normal
      stopped = true;
      toast.error(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Speech recognition permission was denied."
          : e.error === "network"
          ? "Speech recognition needs an internet connection to your browser's speech service."
          : "Speech recognition stopped working."
      );
      setCaptionsOn(false);
    };

    // browsers end a recognition session by themselves after a pause; start it again
    rec.onend = () => {
      if (stopped) return;
      setTimeout(() => {
        if (stopped) return;
        session += 1;
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }, 250);
    };

    try {
      rec.start();
    } catch {
      /* ignore */
    }

    return () => {
      stopped = true;
      rec.onend = null;
      rec.abort();
    };
  }, [captionsOn, active, micOn, socket, speakLang, showMine]);

  // ---- RECEIVING: show the other person's captions, translated into my native language ----
  useEffect(() => {
    if (!socket || !active) return;

    const onCaption = async ({ id, text, lang, final }) => {
      upsertPeer({ id, text, lang, final });

      const src = LANG_CODES[lang];
      const tgt = LANG_CODES[myLangRef.current];
      if (!final || !src || !tgt || src === tgt) return; // same language: nothing to translate

      const status = await packStatus(src, tgt);
      if (status === "available") {
        try {
          const translator = await getTranslator(src, tgt);
          upsertPeer({ id, translated: await translator.translate(text) });
        } catch (err) {
          console.error("Live translation failed:", err);
        }
      } else if (status === "downloadable" || status === "downloading") {
        setPackPrompt((p) => p ?? { lang, src, tgt, state: "needed", progress: 0 });
      } else {
        setTranslateIssue(status === "unsupported" ? "browser" : "pair");
      }
    };

    socket.on("call:caption", onCaption);
    return () => socket.off("call:caption", onCaption);
  }, [socket, active, upsertPeer]);

  // must be started by a click: the browser only allows the language pack download after a user action
  const downloadPack = useCallback(async () => {
    if (!packPrompt) return;
    const { src, tgt } = packPrompt;
    setPackPrompt((p) => p && { ...p, state: "downloading", progress: 0 });
    try {
      await getTranslator(src, tgt, (loaded) => setPackPrompt((p) => p && { ...p, progress: loaded }));
      setPackPrompt(null);
    } catch {
      toast.error("Could not download the translation pack.");
      setPackPrompt((p) => p && { ...p, state: "needed" });
    }
  }, [packPrompt]);

  const toggleCaptions = useCallback(() => {
    if (!captionsOn) {
      toast("Your speech is sent to your browser's speech service (Google in Chrome) to create captions.", {
        duration: 5000,
      });
    }
    setCaptionsOn((v) => !v);
  }, [captionsOn]);

  return {
    captionsOn, toggleCaptions, speakLang, setSpeakChoice,
    myLine, peerLines, packPrompt, downloadPack, translateIssue,
  };
};

export default useLiveCaptions;