"use client";
import React, { useEffect, useRef, useState } from "react";

const LANG_MAP: { [k: string]: { openai: string; tts: string } } = {
  english: { openai: "English", tts: "en-US" },
  hindi: { openai: "Hindi", tts: "hi-IN" },
  japanese: { openai: "Japanese", tts: "ja-JP" },
};

export default function AiRoasterPage() {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<
    "english" | "hindi" | "spanish" | "french"
  >("english");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Setup SpeechRecognition if available
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = LANG_MAP[language].tts;
      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setInput((prev) => (prev ? prev + " " + text : text));
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, [language]);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onend = null;
          recognitionRef.current = null;
        } catch (e) {}
      }
    };
  }, []);

  function startListening() {
    const rec = recognitionRef.current;
    if (!rec) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    try {
      rec.lang = LANG_MAP[language].tts;
      rec.start();
      setIsListening(true);
    } catch (e) {
      console.error(e);
    }
  }

  function stopListening() {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch (e) {}
    }
    setIsListening(false);
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    stopSpeaking();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = LANG_MAP[language].tts;
    utter.rate = 1.0;
    utter.onend = () => setIsSpeaking(false);
    synthUtteranceRef.current = utter;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utter);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (synthUtteranceRef.current) {
      synthUtteranceRef.current.onend = null;
      synthUtteranceRef.current = null;
    }
    setIsSpeaking(false);
  }

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim();
    if (!msg) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          language: LANG_MAP[language].openai,
        }),
      });

      const data = await res.json();
      const reply: string = data.reply ?? "Hmm, I have no roast for that.";
      setMessages((m) => [...m, { role: "assistant", text: reply }]);

      // 🟣 Play ElevenLabs (or fallback) audio
      if (data.audio) {
        const audio = new Audio(data.audio);
        audio
          .play()
          .catch((err) => console.error("Audio playback failed:", err));
      } else {
        // fallback to browser TTS if no audio from API
        speak(reply);
      }
    } catch (err) {
      console.error("Roast error:", err);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Sorry, I couldn't get a roast right now." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-[#e6eef8] p-6 flex items-center justify-center">
      <div className="w-full max-w-3xl bg-[#0f1724] rounded-2xl shadow-xl border border-[#1f2937] overflow-hidden">
        <header className="flex items-center justify-between p-4 border-b border-[#111827]">
          <h1 className="text-xl font-bold">AI Roaster</h1>
          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-[#0b1220] text-[#e6eef8] px-3 py-1 rounded"
            >
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
              <option value="japanese">Japanese</option>
            </select>
            <button
              onClick={() => (isListening ? stopListening() : startListening())}
              className={`px-3 py-1 rounded ${
                isListening ? "bg-red-600" : "bg-[#0b1220]"
              } `}
            >
              {isListening ? "Stop Mic" : "Voice"}
            </button>
            <button
              onClick={() => (isSpeaking ? stopSpeaking() : null)}
              className="px-3 py-1 rounded bg-[#0b1220]"
            >
              Stop
            </button>
          </div>
        </header>

        <main className="p-4">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto p-2 bg-[#071023] rounded">
            {messages.length === 0 && (
              <div className="text-center text-[#9aa6b2] py-10">
                Start by saying "Roast me" or typing a message.
              </div>
            )}
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={m.role === "user" ? "text-right" : "text-left"}
              >
                <div
                  className={`inline-block px-4 py-2 rounded-lg my-1 max-w-[80%] break-words ${
                    m.role === "user"
                      ? "bg-[#1f2937] text-white"
                      : "bg-[#071833] text-[#cfe7ff]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type something like: roast me about my coding skills"
              className="flex-1 px-4 py-2 rounded bg-[#0b1220] text-[#e6eef8]"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading}
              className="px-4 py-2 rounded bg-gradient-to-tr from-[#6A00F1] to-[#a855f7]"
            >
              {loading ? "Roasting..." : "Send"}
            </button>
          </div>
        </main>

        <footer className="p-3 text-xs text-[#9aa6b2] border-t border-[#111827]">
          Built with Next.js • OpenAI • Dark theme • Made by Kartik
        </footer>
      </div>
    </div>
  );
}
