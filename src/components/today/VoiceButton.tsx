"use client";

import { useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  const w = globalThis as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Say what you ate; the words land in the Describe box for you to check before
 * estimating. Uses the browser's own speech recognition. On Chrome that sends
 * the audio to Google's speech service; Safari processes it on Apple's. Where
 * there's no support, a hint points to the keyboard's dictation mic instead.
 */
export function VoiceButton({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported(recognitionCtor() !== null);
    return () => recRef.current?.stop();
  }, []);

  if (supported === null) return null;
  if (!supported) {
    return (
      <p className="self-center text-[12px] text-muted" style={{ maxWidth: 120 }}>
        Tip: use your keyboard&rsquo;s mic to dictate.
      </p>
    );
  }

  function toggle(): void {
    setProblem(null);
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    rec.onerror = (e) => {
      setProblem(e.error === "not-allowed" ? "Microphone access is blocked for this site." : "Didn't catch that. Try again.");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        className={`btn ${listening ? "btn-primary" : "btn-quiet"}`}
        onClick={toggle}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : "Speak what you ate"}
        style={{ minWidth: 52 }}
      >
        {listening ? "● Listening" : "🎙"}
      </button>
      {problem && (
        <span className="mt-1 text-[12px]" style={{ color: "var(--tomato)" }} role="alert">
          {problem}
        </span>
      )}
    </div>
  );
}
