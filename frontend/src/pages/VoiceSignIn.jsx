import React from "react";
import { useNavigate } from "react-router-dom";
import { StatusBar, Orb, VoiceBars } from "../components/UIKit";
import { X, Mic } from "lucide-react";

export default function VoiceSignIn() {
  const navigate = useNavigate();
  return (
    <div className="phone-shell grain flex flex-col">
      
      <div className="px-6 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="w-10 h-10 grid place-items-center text-[#8a94a8]" data-testid="voice-close">
          <X size={22} />
        </button>
        <button className="w-10 h-10 grid place-items-center text-[#8a94a8]">
          <Mic size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <Orb size="default" />
        <p className="mt-16 text-center text-white text-[18px] leading-relaxed max-w-[280px]">
          Hei, jeg er KJAPP AI<br />Hvordan kan jeg hjelpe deg i dag?
        </p>
        <div className="mt-12">
          <VoiceBars />
        </div>
      </div>

      <div className="pb-14 flex justify-center">
        <button className="w-14 h-14 rounded-full bg-mint grid place-items-center mint-glow" data-testid="voice-mic">
          <Mic size={22} className="text-[#04120a]" />
        </button>
      </div>
    </div>
  );
}
