import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, MessageCircle, HelpCircle, Mail, FileText } from "lucide-react";

const ITEMS = [
  { icon: HelpCircle, label: "Vanlige spørsmål", testid: "help-faq" },
  { icon: Mail, label: "Kontakt support", testid: "help-contact" },
  { icon: FileText, label: "Rapporter en sak", testid: "help-report" },
  { icon: MessageCircle, label: "Chat med KJAPP AI", testid: "help-chat" },
];

export default function HelpSupport() {
  const navigate = useNavigate();
  return (
    <div className="px-4 pt-2 pb-10 page-enter">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 grid place-items-center text-[#8a94a8]" data-testid="help-back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-white text-lg font-medium">Hjelp og support</h1>
      </div>

      <div className="card divide-y divide-line">
        {ITEMS.map(({ icon: Icon, label, testid }) => (
          <button
            key={label}
            onClick={() => label.includes("Chat") && navigate("/app/ai")}
            data-testid={testid}
            className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-[#17223a] transition-colors first:rounded-t-[22px] last:rounded-b-[22px]"
          >
            <Icon size={18} className="text-mint" />
            <span className="flex-1 text-white text-sm">{label}</span>
            <ChevronRight size={16} className="text-[#8a94a8]" />
          </button>
        ))}
      </div>

      <div className="mt-6 card p-5 text-center">
        <div className="orb orb-tiny mx-auto" style={{ width: 40, height: 40 }} />
        <div className="mt-3 text-white text-sm font-medium">Trenger du hjelp?</div>
        <div className="text-[#8a94a8] text-xs mt-1">KJAPP AI er tilgjengelig 24/7</div>
        <button
          onClick={() => navigate("/app/ai")}
          className="btn-primary mt-4 w-full"
          data-testid="help-ai-cta"
        >
          Spør KJAPP AI
        </button>
      </div>
    </div>
  );
}
