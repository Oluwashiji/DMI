import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowRight, Check, CirclePlay, Database, MoveRight, ShieldCheck, Menu, X, Zap } from "lucide-react";
import { Brand, SmallArrow, Toast } from "../components/shared/Brand";
import "../components/shared/dm.css";

const features = [
  { icon: Zap, kicker: "01 / Instant", title: "From document to usable data.", body: "Drop in the messiest invoice or receipt. DocuMind recognizes structure, context, and intent in seconds.", stat: "8.4 sec", label: "average extraction" },
  { icon: ShieldCheck, kicker: "02 / Trustworthy", title: "Confidence you can act on.", body: "Every field carries a confidence score and source trace. Review what matters, skip what does not.", stat: "99.2%", label: "field accuracy" },
  { icon: Database, kicker: "03 / Connected", title: "Data that goes somewhere.", body: "Export clean records to your accounting stack, ERP, or data warehouse without rebuilding a workflow.", stat: "42+", label: "native field types" },
];

export function Landing() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [annual, setAnnual] = useState(true);
  const [toast, setToast] = useState("");
  const notify = (msg: string) => setToast(msg);
  const goToAuth = () => navigate("/auth");
  return (
    <main className="dm-root dm-noise">
      <section className="relative min-h-[760px] overflow-hidden">
        <video className="pointer-events-none absolute inset-0 h-full w-full object-cover" src="/hero-bg.mp4" autoPlay muted loop playsInline preload="auto" />
        <div className="pointer-events-none absolute inset-0 bg-white/70" />
        <div className="dm-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute -right-40 top-8 h-[520px] w-[520px] rounded-full bg-[#722F37]/10 blur-[120px]" />
        <header className="relative z-10 flex w-full items-center justify-between px-6 py-6 lg:px-8">
          <Brand />
          <nav className={`${mobile ? "absolute left-4 right-4 top-20 flex" : "hidden md:flex"} items-center gap-8 rounded-2xl border border-[#1c211e]/10 bg-[#ffffff]/95 p-4 text-[12px] text-[#56605a] backdrop-blur-xl md:static md:border-0 md:bg-transparent md:p-0`}>
            <a href="#product" className="transition hover:text-[#1c211e]">Product</a><a href="#workflow" className="transition hover:text-[#1c211e]">How it works</a><a href="#pricing" className="transition hover:text-[#1c211e]">Pricing</a>
            <button onClick={() => notify("Demo request received. We will be in touch.")} className="dm-btn dm-btn-ghost !px-4 !py-2.5">Book a demo <SmallArrow /></button>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={goToAuth} className="hidden text-[12px] font-semibold text-[#56605a] transition hover:text-[#1c211e] sm:block">Sign in</button>
            <button onClick={() => setMobile(!mobile)} className="rounded-lg border border-[#1c211e]/15 p-2 text-[#1c211e] md:hidden">{mobile ? <X size={18} /> : <Menu size={18} />}</button>
            <button onClick={goToAuth} className="dm-btn dm-btn-primary !hidden !px-4 !py-2.5 sm:!inline-flex">Start free <SmallArrow /></button>
          </div>
        </header>
        <div className="relative z-10 mx-auto grid max-w-[1180px] gap-16 px-6 pb-24 pt-20 lg:px-8 lg:pt-28">
          <div className="dm-reveal">
            <h1 className="dm-display max-w-[730px] text-[clamp(3.3rem,7vw,6.6rem)] font-medium leading-[.92] tracking-[-.075em] text-[#1c211e]">The quiet power<br />behind <em className="font-normal text-[#722F37]">clean data.</em></h1>
            <p className="mt-7 max-w-[520px] text-[16px] leading-7 text-[#56605a]">DocuMind turns invoices, receipts, and documents into structured editable data instantly, so operations and finance teams can stop entering, and start moving.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3"><button onClick={goToAuth} className="dm-btn dm-btn-primary">Start extracting for free <ArrowRight size={16} /></button><button onClick={() => notify("Playing a 90-second product tour.")} className="dm-btn dm-btn-ghost"><CirclePlay size={15} /> See it in action</button></div>
            <div className="mt-9 flex items-center gap-4 text-[11px] text-[#6b756e]"><div className="flex -space-x-2">{["AM","JR","KS","NL"].map((i) => <span key={i} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#ffffff] bg-[#f3e3e6] text-[9px] font-bold text-[#4A0E1C]">{i}</span>)}</div><span>Trusted by 2,400+ finance teams</span><span className="h-1 w-1 rounded-full bg-[#722F37]" /><span>No credit card required</span></div>
          </div>
        </div>
        <div className="absolute bottom-9 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[9px] uppercase tracking-[.2em] text-[#6b756e] sm:flex"><ArrowDown size={13} /> Explore the workspace</div>
      </section>

      <section className="border-y border-[#1c211e]/10 bg-[#f4f7f4]/70 py-4"><div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-6 px-6 text-[10px] uppercase tracking-[.16em] text-[#6b756e] lg:px-8"><span>Built for the people behind the numbers</span><span className="dm-display text-[15px] normal-case tracking-[-.04em] text-[#6b756e]">Ledgerly</span><span className="dm-display text-[15px] normal-case tracking-[-.04em] text-[#6b756e]">Rook & Co.</span><span className="dm-display text-[15px] normal-case tracking-[-.04em] text-[#6b756e]">meridian</span><span className="dm-display text-[15px] normal-case tracking-[-.04em] text-[#6b756e]">northstar</span></div></section>

      <section id="product" className="mx-auto max-w-[1180px] px-6 py-28 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]"><div><span className="dm-mono text-[10px] uppercase tracking-[.22em] text-[#4A0E1C]">A better starting point</span><h2 className="dm-display mt-5 max-w-[420px] text-4xl font-medium leading-[1.03] tracking-[-.06em] text-[#1c211e] md:text-5xl">Manual entry is a tax on your best people.</h2></div><p className="max-w-[460px] self-end text-[15px] leading-7 text-[#56605a]">The work is important. The copying is not. DocuMind gives your team a calm, accountable place to turn unstructured documents into decisions.</p></div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">{features.map(({icon: Icon, kicker, title, body, stat, label}) => <article key={kicker} className="dm-glass dm-glass-hover rounded-[22px] p-6 md:min-h-[345px]"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#722F37]/20 bg-[#722F37]/[.08] text-[#4A0E1C]"><Icon size={18} /></div><span className="dm-mono text-[10px] text-[#6b756e]">{kicker}</span></div><h3 className="dm-display mt-16 text-[24px] font-medium leading-tight tracking-[-.05em] text-[#1c211e]">{title}</h3><p className="mt-3 text-[12px] leading-5 text-[#56605a]">{body}</p><div className="mt-8 border-t border-[#1c211e]/10 pt-4"><span className="dm-display text-2xl text-[#722F37]">{stat}</span><span className="ml-2 text-[10px] text-[#6b756e]">{label}</span></div></article>)}</div>
      </section>

      <section id="workflow" className="relative overflow-hidden border-y border-[#1c211e]/10 bg-[#f4f7f4]/50 py-28"><div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_center,rgba(114,47,55,.09),transparent_65%)]" /><div className="relative mx-auto max-w-[1180px] px-6 lg:px-8"><div className="max-w-[500px]"><span className="dm-mono text-[10px] uppercase tracking-[.22em] text-[#4A0E1C]">Three quiet moves</span><h2 className="dm-display mt-5 text-4xl font-medium leading-[1.03] tracking-[-.06em] text-[#1c211e] md:text-5xl">The busywork disappears. The signal stays.</h2></div><div className="mt-16 grid gap-0 lg:grid-cols-3">{[{n:"01",t:"Drop anything in.",b:"Invoices, receipts, POs, bank statements. A file, a folder, or a whole month of backlog."},{n:"02",t:"Let context do the work.",b:"DocuMind maps fields, line items, and relationships, not just text on a page."},{n:"03",t:"Move with confidence.",b:"Edit in place, export to your system, and keep a trace of how every value got there."}].map((x,i)=><div key={x.n} className="relative border-l border-[#1c211e]/15 px-7 py-2 first:border-l-0 first:pl-0 lg:min-h-[230px]"><span className="dm-mono text-[11px] text-[#4A0E1C]">{x.n}</span><h3 className="dm-display mt-10 text-2xl tracking-[-.04em]">{x.t}</h3><p className="mt-3 max-w-[260px] text-[12px] leading-5 text-[#56605a]">{x.b}</p>{i<2&&<MoveRight className="absolute -right-3 top-2 hidden text-[#4A0E1C] lg:block" size={18}/>}</div>)}</div></div></section>

      <section id="pricing" className="mx-auto max-w-[1180px] px-6 py-28 lg:px-8"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><span className="dm-mono text-[10px] uppercase tracking-[.22em] text-[#4A0E1C]">Simple by design</span><h2 className="dm-display mt-5 text-4xl font-medium tracking-[-.06em] md:text-5xl">Start small. Scale cleanly.</h2></div><div className="flex items-center gap-1 rounded-full border border-[#1c211e]/15 bg-[#f5f7f5] p-1 text-[11px]"><button onClick={()=>setAnnual(false)} className={`rounded-full px-4 py-2 ${!annual?"bg-[#722F37] text-[#ffffff]":"text-[#56605a]"}`}>Monthly</button><button onClick={()=>setAnnual(true)} className={`rounded-full px-4 py-2 ${annual?"bg-[#722F37] text-[#ffffff]":"text-[#56605a]"}`}>Yearly <span className="ml-1 text-[#4A0E1C]">−20%</span></button></div></div><div className="mt-14 grid gap-4 md:grid-cols-3"><Price name="Essentials" price={annual ? "$39" : "$49"} detail="For lean teams finding their rhythm." items={["500 pages / month","Core extraction fields","CSV & JSON export"]} /><Price name="Operations" price={annual ? "$129" : "$159"} detail="For teams with a real document flow." items={["2,500 pages / month","Custom field schemas","QuickBooks & NetSuite","Team review workspace"]} featured /><Price name="Scale" price="Let's talk" detail="For complex operations at volume." items={["Unlimited workspaces","Priority processing","SSO & audit controls","Dedicated success partner"]} /></div></section>

      <section className="mx-auto max-w-[1180px] px-6 pb-28 lg:px-8"><div className="relative overflow-hidden rounded-[26px] bg-[#1c211e] px-7 py-14 text-center md:px-20"><div className="pointer-events-none absolute left-1/2 top-0 h-56 w-96 -translate-x-1/2 bg-[#722F37]/10 blur-[90px]" /><span className="relative dm-mono text-[10px] uppercase tracking-[.2em] text-white/60">Your next clear hour</span><h2 className="dm-display relative mx-auto mt-5 max-w-[650px] text-4xl font-medium leading-[1] tracking-[-.06em] text-white md:text-6xl">Give your team their time back.</h2><p className="relative mx-auto mt-5 max-w-[430px] text-[13px] leading-6 text-white/70">A calmer way to process the documents your business runs on.</p><button onClick={goToAuth} className="dm-btn dm-btn-primary relative mt-8 !bg-white !text-[#1c211e] hover:!bg-[#f3e3e6]">Start for free <ArrowRight size={16}/></button></div></section>
      <footer className="w-full border-t border-white/10 bg-[linear-gradient(135deg,#151213_0%,#1c1215_60%,#2b0e17_100%)]">
        <div className="flex w-full flex-col items-center gap-8 px-6 py-12 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 text-[12px] text-white/70">
            <a href="#product" className="transition hover:text-white">Product</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
            <button onClick={()=>notify("Privacy center opened.")} className="transition hover:text-white">Privacy</button>
            <button onClick={()=>notify("Contact form opened.")} className="transition hover:text-white">Contact</button>
          </div>
          <div className="w-full border-t border-white/10 pt-8 text-center text-[11px] text-white/50"><span className="font-semibold text-white/80">DocuMind:</span> Structured clarity for the work behind the work.</div>
        </div>
      </footer>
      {toast && <Toast message={toast} onClose={()=>setToast("")}/>}
    </main>
  );
}

function Price({name,price,detail,items,featured=false}:{name:string;price:string;detail:string;items:string[];featured?:boolean}) { return <div className={`relative rounded-[22px] border p-6 ${featured?"border-[#722F37]/45 bg-[#f8eef0] shadow-[0_0_60px_rgba(114,47,55,.1)]":"border-[#1c211e]/12 bg-[#ffffff]"}`}>{featured&&<span className="absolute -top-3 right-6 rounded-full bg-[#722F37] px-3 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-[#ffffff]">Most popular</span>}<span className="dm-mono text-[10px] uppercase tracking-[.15em] text-[#4A0E1C]">{name}</span><p className="mt-6 text-[12px] text-[#56605a]">{detail}</p><p className="dm-display mt-5 text-4xl tracking-[-.06em]">{price}<span className="text-[12px] text-[#6b756e]">{price[0]==="$"&&"/ month"}</span></p><button className={`dm-btn mt-7 w-full ${featured?"dm-btn-primary":"dm-btn-ghost"}`}>Choose {name} <SmallArrow/></button><ul className="mt-7 space-y-3 border-t border-[#1c211e]/10 pt-6">{items.map(item=><li key={item} className="flex items-center gap-2 text-[11px] text-[#56605a]"><Check size={13} className="text-[#4A0E1C]"/>{item}</li>)}</ul></div>; }