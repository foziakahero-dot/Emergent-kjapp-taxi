import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { aiApi, tripsApi, placesApi } from "../lib/api";
import { Orb, VoiceBars } from "../components/UIKit";
import { Mic, SendHorizonal, ChevronLeft, MapPin, Check, Sparkles, Wallet, Car as CarIcon, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SUGGESTIONS = [
  { text: "Bestill taxi", action: "book" },
  { text: "Hvor mye vil turen koste?", action: "chat" },
  { text: "Når kommer sjåføren?", action: "chat" },
  { text: "Endre destinasjon", action: "chat" },
];

const PLACES_FALLBACK = [
  { name: "Karl Johans gate 1", lat: 59.9127, lng: 10.7461 },
  { name: "Aker Brygge", lat: 59.9106, lng: 10.7285 },
  { name: "Oslo S", lat: 59.9110, lng: 10.7530 },
  { name: "Vigelandsparken", lat: 59.9268, lng: 10.7005 },
  { name: "Grünerløkka", lat: 59.9250, lng: 10.7580 },
  { name: "Gardermoen (OSL)", lat: 60.1975, lng: 11.1004 },
];

const VEHICLE_META = {
  "ai-first": { name: "Standard", desc: "Smart tildeling", Icon: Sparkles },
  "enkelt": { name: "Sparsom", desc: "Beste pris", Icon: Wallet },
  "trygg": { name: "Komfort", desc: "Familie / plassrik", Icon: CarIcon },
  "premium": { name: "Premium", desc: "Business — Tesla / Mercedes", Icon: Star },
};

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [bookingStep, setBookingStep] = useState(null); // null | 'pickup' | 'dropoff' | 'category' | 'confirm' | 'booking'
  const [booking, setBooking] = useState({ pickup: null, dropoff: null, vehicle: null, estimate: null });
  const [places, setPlaces] = useState(PLACES_FALLBACK);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const endRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    aiApi.history().then((h) => setMessages(h.messages || [])).catch(() => {});
    placesApi.list().then((r) => setPlaces(r.places || PLACES_FALLBACK)).catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, bookingStep]);

  const startBooking = () => {
    setMessages((m) => [
      ...m,
      { role: "user", content: "Jeg vil bestille en taxi" },
      { role: "assistant", content: "Perfekt! Hvor skal du hentes?", ui: "picker", field: "pickup" },
    ]);
    setBookingStep("pickup");
  };

  const pickPlace = async (place) => {
    if (bookingStep === "pickup") {
      const newBooking = { ...booking, pickup: place };
      setBooking(newBooking);
      setMessages((m) => [
        ...m,
        { role: "user", content: `Fra ${place.name}` },
        { role: "assistant", content: "Bra. Hvor skal turen ende?", ui: "picker", field: "dropoff" },
      ]);
      setBookingStep("dropoff");
    } else if (bookingStep === "dropoff") {
      const newBooking = { ...booking, dropoff: place };
      setBooking(newBooking);
      // fetch estimate
      const est = await tripsApi.estimate({
        pickup_lat: newBooking.pickup.lat,
        pickup_lng: newBooking.pickup.lng,
        dropoff_lat: place.lat,
        dropoff_lng: place.lng,
      });
      setBooking({ ...newBooking, estimate: est });
      setMessages((m) => [
        ...m,
        { role: "user", content: `Til ${place.name}` },
        {
          role: "assistant",
          content: `Turen er ca. ${est.distance_km} km og tar rundt ${est.duration_min} minutter. Velg kategori:`,
          ui: "category",
          options: est.options,
        },
      ]);
      setBookingStep("category");
    }
  };

  const pickCategory = (opt) => {
    setBooking((b) => ({ ...b, vehicle: opt.vehicle_type }));
    const meta = VEHICLE_META[opt.vehicle_type];
    setMessages((m) => [
      ...m,
      { role: "user", content: `${meta.name}` },
      {
        role: "assistant",
        content: `${meta.name} valgt. Turen koster ${opt.price} kr. Vil du bekrefte bestillingen?`,
        ui: "confirm",
        option: opt,
      },
    ]);
    setBookingStep("confirm");
  };

  const confirmBooking = async () => {
    setBookingStep("booking");
    try {
      const trip = await tripsApi.request({
        pickup_address: booking.pickup.name,
        pickup_lat: booking.pickup.lat,
        pickup_lng: booking.pickup.lng,
        dropoff_address: booking.dropoff.name,
        dropoff_lat: booking.dropoff.lat,
        dropoff_lng: booking.dropoff.lng,
        vehicle_type: booking.vehicle,
      });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Bestilling bekreftet. Vi finner en sjåfør til deg nå.` },
      ]);
      setTimeout(() => navigate(`/app/booking/${trip.trip_id}`), 1200);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Beklager, noe gikk galt. Prøv igjen." },
      ]);
      setBookingStep(null);
    }
  };

  const cancelBooking = () => {
    setBookingStep(null);
    setBooking({ pickup: null, dropoff: null, vehicle: null, estimate: null });
    setMessages((m) => [...m, { role: "assistant", content: "Bestillingen er avbrutt. Si fra om jeg kan hjelpe med noe annet." }]);
  };

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    // Quick trigger for booking
    if (/bestill|book|taxi|hent|reise/i.test(msg) && !bookingStep) {
      setInput("");
      startBooking();
      return;
    }
    setInput("");
    const optimistic = [...messages, { role: "user", content: msg }];
    setMessages(optimistic);
    setSending(true);
    try {
      const res = await aiApi.chat(msg);
      setMessages([...optimistic, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages([...optimistic, { role: "assistant", content: "Beklager, jeg fikk et hikk. Prøv igjen." }]);
    } finally {
      setSending(false);
    }
  };

  const empty = messages.length === 0 && !bookingStep;

  const stopRecording = () => {
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (recording || transcribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1000) return;
        setTranscribing(true);
        try {
          const b64 = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result).split(",")[1]);
            r.onerror = rej;
            r.readAsDataURL(blob);
          });
          const r = await aiApi.transcribe(b64, mime, "no");
          const text = (r.text || "").trim();
          if (text) {
            setInput(text);
            // Auto-send after brief pause so user can see what was heard
            setTimeout(() => send(text), 400);
          }
        } catch (e) {
          alert("Kunne ikke transkribere: " + (e.response?.data?.detail || "prøv igjen"));
        } finally {
          setTranscribing(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      // Auto-stop after 15s max
      setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 15000);
    } catch (e) {
      alert("Mikrofon-tilgang avslått: " + (e.message || "prøv igjen"));
    }
  };

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100dvh - 80px)" }}>
      <div className="px-4 pt-2 pb-1 flex items-center gap-2">
        <button onClick={() => navigate("/app")} className="w-10 h-10 grid place-items-center text-[#7a827a]" data-testid="ai-back">
          <ChevronLeft size={22} />
        </button>
        <div className="orb orb-tiny" style={{ width: 30, height: 30 }} />
        <div className="flex-1">
          <div className="text-white text-sm font-medium">KJAPP AI</div>
          <div className="text-[11px] text-mint flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" /> Tilgjengelig 24/7
          </div>
        </div>
      </div>

      {empty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <Orb size="default" />
          <div className="mt-10 text-white text-lg">Spør KJAPP AI</div>
          <div className="text-[#7a827a] text-sm mt-1">om hva som helst…</div>

          <div className="mt-8 w-full space-y-2 max-w-[300px]">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                onClick={() => (s.action === "book" ? startBooking() : send(s.text))}
                data-testid={`suggestion-${s.text}`}
                className="w-full text-left px-4 py-3 rounded-full bg-[#131a1f] border border-line hover:border-mint transition-colors text-[#e8e0d0] text-sm"
              >
                {s.text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4 pb-4 space-y-3">
          {messages.map((m, i) => (
            <React.Fragment key={i}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  data-testid={`msg-${m.role}`}
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-mint text-[#04120a] rounded-br-md"
                      : "bg-[#17222a] border border-line text-[#e8e0d0] rounded-bl-md"
                  }`}
                >
                  {m.content}
                </div>
              </motion.div>

              {/* UI attachments */}
              {m.ui === "picker" && i === messages.length - 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-2 px-1">
                  {places.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => pickPlace(p)}
                      data-testid={`ai-place-${p.name}`}
                      className="text-left px-3 py-2.5 rounded-xl bg-[#17222a] border border-line hover:border-mint transition-colors"
                    >
                      <div className="flex items-center gap-1.5 text-mint text-[11px] uppercase tracking-widest">
                        <MapPin size={11} /> Sted
                      </div>
                      <div className="text-white text-sm mt-0.5 truncate">{p.name}</div>
                    </button>
                  ))}
                </motion.div>
              )}

              {m.ui === "category" && i === messages.length - 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 px-1">
                  {m.options.map((opt) => {
                    const meta = VEHICLE_META[opt.vehicle_type];
                    const Ic = meta.Icon || Sparkles;
                    return (
                      <button
                        key={opt.vehicle_type}
                        onClick={() => pickCategory(opt)}
                        data-testid={`ai-category-${opt.vehicle_type}`}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl transition-colors text-left"
                        style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)" }}
                      >
                        <div className="w-10 h-10 rounded-full grid place-items-center" style={{ background: "rgba(201,161,91,0.12)" }}>
                          <Ic size={16} style={{ color: "var(--accent)" }} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{meta.name}</div>
                          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{meta.desc} · {opt.eta_min} min</div>
                        </div>
                        <div className="font-display text-[16px]" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{opt.price} kr</div>
                      </button>
                    );
                  })}
                </motion.div>
              )}

              {m.ui === "confirm" && i === messages.length - 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-4 space-y-3">
                  <div className="text-[11px] text-mint uppercase tracking-widest">Bekreft bestilling</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-[#7a827a]">Fra</span><span className="text-white text-right truncate max-w-[60%]">{booking.pickup?.name}</span></div>
                    <div className="flex justify-between"><span className="text-[#7a827a]">Til</span><span className="text-white text-right truncate max-w-[60%]">{booking.dropoff?.name}</span></div>
                    <div className="flex justify-between"><span className="text-[#7a827a]">Kategori</span><span className="text-white">{VEHICLE_META[m.option.vehicle_type].name}</span></div>
                    <div className="flex justify-between"><span className="text-[#7a827a]">Estimert tid</span><span className="text-white">{m.option.eta_min} min</span></div>
                    <div className="flex justify-between border-t border-line pt-2 mt-2">
                      <span className="text-white font-medium">Total</span>
                      <span className="text-white font-semibold text-lg">{m.option.price} kr</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={cancelBooking} data-testid="ai-cancel" className="btn-ghost flex-1 text-sm">Avbryt</button>
                    <button onClick={confirmBooking} data-testid="ai-confirm" className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
                      <Check size={16} /> Bekreft
                    </button>
                  </div>
                </motion.div>
              )}
            </React.Fragment>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-[#17222a] border border-line rounded-2xl px-4 py-3">
                <VoiceBars />
              </div>
            </div>
          )}
          {bookingStep === "booking" && (
            <div className="flex justify-center py-4">
              <div className="orb orb-tiny" />
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={transcribing ? "Hører hva du sier…" : recording ? "Snakker… (trykk stopp)" : "Skriv en melding…"}
            className="input flex-1"
            disabled={recording || transcribing}
            data-testid="chat-input"
          />
          {input.trim() ? (
            <button
              onClick={() => send()}
              disabled={sending}
              data-testid="chat-send"
              className="w-12 h-12 rounded-full bg-mint text-[#04120a] grid place-items-center mint-glow disabled:opacity-50"
            >
              <SendHorizonal size={18} />
            </button>
          ) : (
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
              data-testid="chat-mic"
              className={`w-12 h-12 rounded-full grid place-items-center disabled:opacity-50 ${
                recording ? "bg-red-500 text-white animate-pulse" : "bg-mint text-[#04120a] mint-glow"
              }`}
              title={recording ? "Stopp opptak" : "Snakk til KJAPP AI"}
            >
              <Mic size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
