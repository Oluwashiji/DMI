import { ArrowUpRight, Check, FileText, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import "./dm.css";

export function Brand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#722F37] text-[#ffffff] shadow-[0_0_26px_rgba(114,47,55,.2)]">
        <FileText size={16} strokeWidth={2.5} />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#722F37] bg-[#ffffff]" />
      </div>
      {!compact && <span className={`dm-display text-[17px] font-semibold tracking-[-.04em] ${light ? "text-white" : "text-[#1c211e]"}`}>Docu<span className={light ? "text-[#F3D2D8]" : "text-[#4A0E1C]"}>Mind</span></span>}
    </div>
  );
}

export function StatusPill({ children, gold = false }: { children: ReactNode; gold?: boolean }) {
  return <span className={`dm-pill ${gold ? "!border-[#722F37]/30 !bg-[#722F37]/10 !text-[#4A0E1C]" : ""}`}><span className={`dm-dot ${gold ? "!bg-[#722F37] !shadow-none" : ""}`} />{children}</span>;
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#722F37]/25 bg-[#ffffff]/95 px-4 py-3 text-xs text-[#1c211e] shadow-2xl backdrop-blur-xl">
    <Check size={14} className="text-[#4A0E1C]" /> {message}
    <button onClick={onClose} className="ml-1 text-[#56605a] hover:text-white">×</button>
  </div>;
}

export function SmallArrow() { return <ArrowUpRight size={14} strokeWidth={2.3} />; }
export function AIWordmark() { return <span className="inline-flex items-center gap-1.5"><Sparkles size={13} className="text-[#4A0E1C]" />DocuMind AI</span>; }