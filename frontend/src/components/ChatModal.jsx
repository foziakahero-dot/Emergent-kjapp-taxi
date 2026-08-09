import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, SendHorizonal } from "lucide-react";
import { tripsApi } from "../lib/api";

const QUICK_REPLIES_PASSENGER = [
  "Jeg står utenfor",
  "Kommer ned nå",
  "Vent 1 minutt",
  "Kan du parkere ved inngangen?",
];

const QUICK_REPLIES_DRIVER = [
  "Jeg er utenfor døra",
  "3 minutter unna",
  "Kommer nå",
  "Kan du komme ut?",
];

export default function ChatModal({ open, onClose, tripId, role }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!open || !tripId) return;
    let mounted = true;
    const load = async () => {
      try {
        const r = await tripsApi.messages(tripId);
        if (mounted) setMessages(r.messages || []);
      } catch (_e) { /* transient poll error */ }
    };
    load();
    const i = setInterval(load, 2500);
    return () => { mounted = false; clearInterval(i); };
  }, [open, tripId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || sending) return;
    setInput("");
    setSending(true);
    try {
      const msg = await tripsApi.sendMessage(tripId, t);
      setMessages((m) => [...m, msg]);
    } catch (e) {
      alert("Kunne ikke sende: " + (e.response?.data?.detail || e.message));
    } finally {
      setSending(false);
    }
  };

  const quick = role === "driver" ? QUICK_REPLIES_DRIVER : QUICK_REPLIES_PASSENGER;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-end"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[440px] mx-auto bg-[#0e1113] border-t border-line rounded-t-3xl flex flex-col"
            style={{ maxHeight: "82dvh", minHeight: "60dvh" }}
          >
            {/* Header */}
            <div className="px-4 pt-3 flex items-center gap-3 border-b border-line pb-3">
              <div className="w-10 h-10 rounded-full bg-mint/10 grid place-items-center">
                <div className="orb orb-tiny" style={{ width: 22, height: 22 }} />
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-medium">Melding</div>
                <div className="text-[11px] text-mint">
                  {role === "driver" ? "Til kunde" : "Til sjåfør"} · sikker tilkobling
                </div>
              </div>
              <button onClick={onClose} data-testid="chat-close" className="w-9 h-9 grid place-items-center text-[#7a8388] rounded-full hover:bg-[#141719]">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-2">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="orb orb-tiny mx-auto" style={{ width: 40, height: 40 }} />
                  <div className="text-[#7a8388] text-sm mt-3">Ingen meldinger ennå</div>
                  <div className="text-[11px] text-[#5a6166] mt-1">Bruk hurtigsvar under, eller skriv fritt</div>
                </div>
              )}
              {messages.map((m, i) => {
                const isMe = m.from_role === role;
                return (
                  <div key={m.id || i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      data-testid={`chatmsg-${m.from_role}`}
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed ${
                        isMe ? "bg-mint text-[#04120a] rounded-br-md" : "bg-[#141719] border border-line text-[#e6ecef] rounded-bl-md"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Quick replies */}
            <div className="px-3 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
              {quick.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={sending}
                  data-testid={`quick-${q}`}
                  className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[#141719] border border-line text-[#a1a7ab] text-[12px] hover:border-mint hover:text-mint transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-2 flex items-center gap-2 border-t border-line">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={role === "driver" ? "Melding til kunde…" : "Melding til sjåfør…"}
                className="input flex-1"
                data-testid="chat-input-field"
                maxLength={500}
              />
              <button
                onClick={() => send()}
                disabled={sending || !input.trim()}
                data-testid="chat-send-btn"
                className="w-11 h-11 rounded-full bg-mint text-[#04120a] grid place-items-center mint-glow disabled:opacity-50"
              >
                <SendHorizonal size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
