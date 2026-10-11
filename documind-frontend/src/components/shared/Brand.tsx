import { ArrowUpRight, Check, FileText, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import "../_group.css";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#9df4b1] text-[#07110a] shadow-[0_0_26px_rgba(157,244,177,.2)]">
        <FileText size={16} strokeWidth={2.5} />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#07110a] bg-[#d9b66d]" />
      </div>
      {!compact && <span className="dm-display text-[17px] font-semibold tracking-[-.04em] text-[#e8f0e5]">Docu<span className="text-[#9df4b1]">Mind</span></span>}
    </div>
  );
}

export function StatusPill({ children, gold = false }: { children: ReactNode; gold?: boolean }) {
  return <span className={`dm-pill ${gold ? "!border-[#d9b66d]/30 !bg-[#d9b66d]/10 !text-[#efd08d]" : ""}`}><span className={`dm-dot ${gold ? "!bg-[#d9b66d] !shadow-none" : ""}`} />{children}</span>;
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#9df4b1]/25 bg-[#132119]/95 px-4 py-3 text-xs text-[#e8f0e5] shadow-2xl backdrop-blur-xl">
    <Check size={14} className="text-[#9df4b1]" /> {message}
    <button onClick={onClose} className="ml-1 text-[#95a69a] hover:text-white">×</button>
  </div>;
}

export function SmallArrow() { return <ArrowUpRight size={14} strokeWidth={2.3} />; }
export function AIWordmark() { return <span className="inline-flex items-center gap-1.5"><Sparkles size={13} className="text-[#d9b66d]" />DocuMind AI</span>; }