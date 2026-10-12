import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Bell, ChevronDown, CircleHelp, Download, FileArchive, FileCheck2, FileJson, FolderOpen, LayoutDashboard, LogOut, Menu, MoreHorizontal, PanelLeftClose, Plus, Settings, ShieldCheck, SlidersHorizontal, Sparkles, UploadCloud, Users, Zap } from "lucide-react";
import { Brand, StatusPill, Toast } from "../components/shared/Brand";
import "../components/shared/dm.css";
import { useAuth } from "../context/AuthContext";
import {
  ApiError,
  exportCsv,
  exportExcel,
  extractDocument,
  getHistory,
  updateExtraction,
  type ExtractedInvoice,
  type ExtractionRecord,
  type ExtractProgressEvent,
} from "../lib/api";

type View = "Overview" | "Documents" | "Exports" | "Team" | "Settings";
const nav = [{ label: "Overview", icon: LayoutDashboard }, { label: "Documents", icon: FolderOpen }, { label: "Exports", icon: FileArchive }, { label: "Team", icon: Users }, { label: "Settings", icon: Settings }];

interface EditableRow {
  field: string;
  value: string;
}

function rowsFromExtraction(record: ExtractionRecord): EditableRow[] {
  const d = record.extracted_data;
  if (!d) return [];
  return [
    { field: "Vendor name", value: d.vendor_name ?? "" },
    { field: "Invoice number", value: d.invoice_number ?? "" },
    { field: "Date", value: d.date ?? "" },
    { field: "Subtotal", value: d.subtotal != null ? String(d.subtotal) : "" },
    { field: "Tax", value: d.tax != null ? String(d.tax) : "" },
    { field: "Total", value: d.total != null ? String(d.total) : "" },
    { field: "Currency", value: d.currency ?? "" },
  ];
}

function numberOrNull(value: string): number | null {
  const n = parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Rebuilds the invoice from the (possibly edited) form fields. Line items are kept as extracted. */
function invoiceFromRows(base: ExtractedInvoice, rows: EditableRow[]): ExtractedInvoice {
  const get = (field: string) => rows.find((r) => r.field === field)?.value.trim() ?? "";
  return {
    ...base,
    vendor_name: get("Vendor name") || null,
    invoice_number: get("Invoice number") || null,
    date: get("Date") || null,
    subtotal: numberOrNull(get("Subtotal")),
    tax: numberOrNull(get("Tax")),
    total: numberOrNull(get("Total")),
    currency: get("Currency") || null,
  };
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>("Overview");
  const [sidebar, setSidebar] = useState(true);
  const [drop, setDrop] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stageMessage, setStageMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [json, setJson] = useState(false);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [toast, setToast] = useState("");
  const [activeExtraction, setActiveExtraction] = useState<ExtractionRecord | null>(null);
  const [history, setHistory] = useState<ExtractionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = () => {
    setHistoryLoading(true);
    setHistoryError("");
    getHistory()
      .then(setHistory)
      .catch((err) => setHistoryError(err instanceof ApiError ? err.message : "Could not load history."))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setDrop(false);
    setProcessing(true);
    setProgress(0);
    setStageMessage("Uploading " + file.name);
    try {
      const record = await extractDocument(file, (event: ExtractProgressEvent) => {
        setProgress(event.progress);
        if (event.message) setStageMessage(event.message);
      });
      setActiveExtraction(record);
      setRows(rowsFromExtraction(record));
      setToast("Document extracted and ready for review.");
      setView("Documents");
      loadHistory();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Extraction failed. Please try again.";
      setToast(message);
    } finally {
      setProcessing(false);
    }
  };

  const startUpload = () => inputRef.current?.click();

  const handleExport = async (format: "csv" | "excel") => {
    if (!activeExtraction || !activeExtraction.extracted_data) {
      setToast("Upload and extract a document first.");
      return;
    }
    try {
      // Save any edits first, so the export contains what is on screen.
      const saved = await updateExtraction(activeExtraction.id, invoiceFromRows(activeExtraction.extracted_data, rows));
      setActiveExtraction(saved);
      loadHistory();
      if (format === "csv") await exportCsv(saved.id, `${saved.filename}.csv`);
      else await exportExcel(saved.id, `${saved.filename}.xlsx`);
      setToast(`${format.toUpperCase()} export downloaded.`);
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : "Export failed. Please try again.");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const openExtraction = (record: ExtractionRecord) => {
    setActiveExtraction(record);
    setRows(rowsFromExtraction(record));
    setView("Documents");
  };

  const initials = (user?.full_name ?? user?.email ?? "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

  return <main className="dm-root dm-noise flex min-h-[100dvh]">
    <aside className={`${sidebar ? "w-[230px]" : "w-[72px]"} dm-hide-mobile shrink-0 border-r border-[#1c211e]/10 bg-[#f7f9f7] p-4 transition-all duration-300`}>
      <div className={`flex items-center ${sidebar ? "justify-between" : "justify-center"} px-1`}><Brand compact={!sidebar} />{sidebar && <button onClick={() => setSidebar(false)} className="text-[#6b756e] hover:text-[#1c211e]"><PanelLeftClose size={16} /></button>}</div>
      {!sidebar && <button onClick={() => setSidebar(true)} className="mt-7 w-full text-[#6b756e] hover:text-[#1c211e]"><Menu size={17} className="mx-auto" /></button>}
      <button onClick={startUpload} className={`dm-btn dm-btn-primary mt-9 ${sidebar ? "w-full" : "!px-2.5"}`}><Plus size={16} />{sidebar && "New document"}</button>
      <div className="mt-8 space-y-1">{nav.map(({ label, icon: Icon }) => <button key={label} onClick={() => setView(label as View)} title={label} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[11px] font-semibold transition ${view === label ? "bg-[#e3efe3] text-[#006400]" : "text-[#5f6962] hover:bg-[#eef3ee] hover:text-[#1c211e]"}`}><Icon size={16} />{sidebar && label}{sidebar && label === "Documents" && history.length > 0 && <span className="ml-auto rounded-full bg-[#006400] px-1.5 py-0.5 text-[9px] text-[#ffffff]">{history.length}</span>}</button>)}</div>
      <div className={`${sidebar ? "" : "hidden"} absolute bottom-5 ml-1 flex items-center gap-2`}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#006400] text-[10px] font-bold text-[#ffffff]">{initials}</span>
        <div><p className="max-w-[110px] truncate text-[10px] font-bold">{user?.full_name ?? user?.email}</p><button onClick={handleLogout} className="flex items-center gap-1 text-[9px] text-[#6b756e] hover:text-[#1c211e]"><LogOut size={10} /> Sign out</button></div>
      </div>
    </aside>
    <section className="min-w-0 flex-1">
      <header className="flex h-[72px] items-center justify-between border-b border-[#1c211e]/10 px-5 md:px-8">
        <div className="flex items-center gap-4"><button onClick={() => setSidebar(!sidebar)} className="hidden text-[#6b756e] md:block"><PanelLeftClose size={17} /></button><div><p className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#6b756e]">Workspace / {view}</p><h1 className="dm-display mt-1 text-lg font-medium tracking-[-.04em]">{view === "Overview" ? `Good to see you, ${user?.full_name?.split(" ")[0] ?? "there"}.` : "Your " + view.toLowerCase()}</h1></div></div>
        <div className="flex items-center gap-3"><button onClick={() => setToast("No new notifications.")} className="relative rounded-lg p-2 text-[#5f6962] hover:bg-[#eef3ee] hover:text-[#1c211e]"><Bell size={17} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#006400]" /></button><button onClick={() => setToast("Help center is not available yet.")} className="hidden rounded-lg p-2 text-[#5f6962] hover:bg-[#eef3ee] hover:text-[#1c211e] sm:block"><CircleHelp size={17} /></button><span className="h-7 w-px bg-[#1c211e]/10" /><button onClick={handleLogout} className="flex items-center gap-2 text-left"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#006400] text-[10px] font-bold text-[#ffffff]">{initials}</span><ChevronDown size={14} className="text-[#6b756e]" /></button></div>
      </header>
      <div className="dm-scrollbar h-[calc(100dvh-72px)] overflow-y-auto p-5 md:p-8">
        {view === "Overview" && <>
          <div className="grid gap-4 md:grid-cols-3">
            <Stat title="Documents processed" value={String(history.length)} note="all time" icon={FileCheck2} />
            <Stat title="Latest status" value={activeExtraction ? activeExtraction.status : "-"} note={activeExtraction ? activeExtraction.filename : "No document yet"} icon={Sparkles} />
            <Stat title="Ready for review" value={String(history.filter((h) => h.status === "complete").length)} note="completed extractions" icon={Zap} gold />
          </div>
          <div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
            <div className="dm-glass rounded-2xl p-5 md:p-6">
              <div className="flex items-start justify-between"><div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#006400]">Process a document</span><h2 className="dm-display mt-2 text-2xl tracking-[-.05em]">Make the next one count.</h2><p className="mt-1 text-[11px] text-[#5f6962]">PDF, PNG or JPG · up to 25 MB</p></div><button onClick={startUpload} className="dm-btn dm-btn-ghost !hidden !px-3 !py-2 sm:!inline-flex"><SlidersHorizontal size={14} /> Configure</button></div>
              <div onClick={startUpload} className={`relative mt-6 flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed ${drop ? "border-[#006400] bg-[#006400]/[.08]" : "border-[#1c211e]/20 bg-[#f7f9f7]/60"} transition hover:border-[#006400]/60`}>
                <div className="absolute left-5 top-5 flex items-center gap-2 text-[9px] uppercase tracking-[.13em] text-[#6b756e]"><span className="h-1.5 w-1.5 rounded-full bg-[#006400]" /> Secure upload</div>
                {processing ? <>
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#006400]/30 bg-[#e3efe3] text-[#006400]"><UploadCloud size={25} /><span className="absolute inset-[-7px] rounded-full border border-[#006400]/20" /></div>
                  <p className="mt-5 text-[12px] font-semibold">{stageMessage || "Processing…"}</p>
                  <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-[#dfe6df]"><div style={{ width: `${progress}%` }} className="h-full rounded-full bg-[#006400] transition-all duration-500" /></div>
                  <span className="dm-mono mt-2 text-[9px] text-[#006400]">{progress}%</span>
                </> : <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#006400]/20 bg-[#e3efe3] text-[#006400] shadow-[0_0_35px_rgba(0,100,0,.1)]"><UploadCloud size={25} /></div>
                  <p className="mt-5 text-[12px] font-semibold">Drop a document here</p>
                  <p className="mt-2 text-[10px] text-[#5f6962]">or <span className="font-bold text-[#006400]">browse from your computer</span></p>
                </>}
              </div>
              <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileSelected} />
            </div>
            <div className="dm-glass rounded-2xl p-5 md:p-6"><div className="flex items-center justify-between"><div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#006400]">At a glance</span><h2 className="dm-display mt-2 text-xl tracking-[-.05em]">This workspace</h2></div><BarChart3 size={18} className="text-[#6b756e]" /></div><div className="mt-7 space-y-3 text-[11px] text-[#56605a]"><p>{history.length} document{history.length === 1 ? "" : "s"} processed so far.</p><p>{history.filter((h) => h.status === "complete").length} ready for review.</p><p>{history.filter((h) => h.status === "failed").length} failed extractions.</p></div></div>
          </div>
          <History docs={history} loading={historyLoading} error={historyError} onOpen={openExtraction} onViewAll={() => setView("Documents")} />
        </>}
        {view === "Documents" && <Documents record={activeExtraction} rows={rows} setRows={setRows} json={json} setJson={setJson} onExport={handleExport} onToast={setToast} />}
        {view === "Exports" && <Exports onExport={handleExport} hasExtraction={!!activeExtraction} />}
        {view === "Team" && <Team onToast={setToast} />}
        {view === "Settings" && <SettingsView onToast={setToast} />}
      </div>
    </section>
    {toast && <Toast message={toast} onClose={() => setToast("")} />}
  </main>;
}

function Stat({ title, value, note, icon: Icon, gold = false }: { title: string; value: string; note: string; icon: typeof Zap; gold?: boolean }) {
  return <div className="dm-glass rounded-2xl p-5"><div className="flex items-center justify-between"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${gold ? "bg-[#006400]/10 text-[#006400]" : "bg-[#006400]/[.08] text-[#006400]"}`}><Icon size={15} /></span><MoreHorizontal size={16} className="text-[#6b756e]" /></div><p className="mt-5 text-[10px] text-[#5f6962]">{title}</p><p className="dm-display mt-1 truncate text-3xl tracking-[-.06em]">{value}</p><p className="mt-2 truncate text-[10px] text-[#006400]">{note}</p></div>;
}

function History({ docs, loading, error, onOpen, onViewAll }: { docs: ExtractionRecord[]; loading: boolean; error: string; onOpen: (r: ExtractionRecord) => void; onViewAll: () => void }) {
  return <div className="mt-8">
    <div className="mb-4 flex items-center justify-between"><div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#6b756e]">Your activity</span><h2 className="dm-display mt-1 text-xl tracking-[-.05em]">Recent documents</h2></div><button onClick={onViewAll} className="text-[10px] font-bold text-[#006400]">View all <span className="ml-1">→</span></button></div>
    <div className="overflow-hidden rounded-2xl border border-[#1c211e]/10 bg-[#ffffff]">
      <div className="grid grid-cols-[1.4fr_1fr_.7fr_.65fr_.5fr_auto] gap-3 border-b border-[#1c211e]/10 px-5 py-3 text-[9px] uppercase tracking-[.1em] text-[#6b756e]"><span>Document</span><span>Vendor</span><span>Total</span><span>Uploaded</span><span>Status</span><span /></div>
      {loading && <div className="px-5 py-8 text-center text-[11px] text-[#6b756e]">Loading history…</div>}
      {!loading && error && <div className="px-5 py-8 text-center text-[11px] text-[#b3412b]">{error}</div>}
      {!loading && !error && docs.length === 0 && <div className="px-5 py-8 text-center text-[11px] text-[#6b756e]">No documents processed yet. Upload one to get started.</div>}
      {!loading && !error && docs.map((doc) => <button key={doc.id} onClick={() => onOpen(doc)} className="dm-table-row grid w-full grid-cols-[1.4fr_1fr_.7fr_.65fr_.5fr_auto] items-center gap-3 border-b border-[#1c211e]/[.07] px-5 py-4 text-left last:border-0">
        <span className="flex min-w-0 items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#e3efe3] text-[#006400]"><FileCheck2 size={14} /></span><span className="truncate text-[10px] font-semibold">{doc.filename}</span></span>
        <span className="truncate text-[10px] text-[#56605a]">{doc.extracted_data?.vendor_name ?? "-"}</span>
        <span className="text-[10px] text-[#006400]">{doc.extracted_data?.total != null ? `${doc.extracted_data.currency ?? ""} ${doc.extracted_data.total}`.trim() : "-"}</span>
        <span className="text-[9px] text-[#5f6962]">{new Date(doc.created_at).toLocaleDateString()}</span>
        <span className="dm-mono text-[9px] text-[#006400]">{doc.status}</span>
        <MoreHorizontal size={14} className="text-[#6b756e]" />
      </button>)}
    </div>
  </div>;
}

function Documents({ record, rows, setRows, json, setJson, onExport, onToast }: { record: ExtractionRecord | null; rows: EditableRow[]; setRows: (r: EditableRow[]) => void; json: boolean; setJson: (v: boolean) => void; onExport: (format: "csv" | "excel") => void; onToast: (x: string) => void }) {
  if (!record) {
    return <EmptyView icon={FolderOpen} title="No document open yet." body="Upload a document from the Overview tab, or pick one from your history, to review its extracted data here." action="Go to Overview" onClick={() => onToast("Use \"New document\" in the sidebar to upload.")} />;
  }
  return <>
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#006400]">Review workspace</span><h2 className="dm-display mt-2 text-3xl tracking-[-.06em]">{record.filename}</h2><p className="mt-2 text-[11px] text-[#5f6962]">{record.extracted_data?.vendor_name ?? "Vendor unknown"} · Uploaded {new Date(record.created_at).toLocaleString()}</p></div>
      <div className="flex gap-2"><button onClick={() => setJson(!json)} className="dm-btn dm-btn-ghost !px-3 !py-2.5"><FileJson size={14} />{json ? "Fields" : "JSON"}</button><button onClick={() => onExport("csv")} className="dm-btn dm-btn-ghost !px-3 !py-2.5"><Download size={14} /> CSV</button><button onClick={() => onExport("excel")} className="dm-btn dm-btn-primary !px-3 !py-2.5"><Download size={14} /> Excel</button></div>
    </div>
    <div className="mt-7 dm-glass rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between border-b border-[#1c211e]/10 pb-5"><div><span className="dm-mono text-[9px] uppercase tracking-[.14em] text-[#006400]">Extracted data</span><h3 className="dm-display mt-2 text-xl tracking-[-.05em]">{json ? "JSON preview" : "Editable fields"}</h3></div><StatusPill>{record.status === "complete" ? "Ready for review" : record.status}</StatusPill></div>
      {json ? <pre className="dm-mono mt-5 overflow-auto rounded-xl bg-[#f5f7f5] p-5 text-[10px] leading-6 text-[#006400]">{JSON.stringify(record.extracted_data, null, 2)}</pre> : <div className="mt-5 space-y-2">
        {rows.map((r, i) => <div key={r.field} className="grid grid-cols-[.7fr_1fr] items-center gap-3 border-b border-[#1c211e]/[.08] py-3"><p className="text-[10px] text-[#5f6962]">{r.field}</p><input value={r.value} onChange={(e) => setRows(rows.map((item, idx) => (idx === i ? { ...item, value: e.target.value } : item)))} className="dm-input" /></div>)}
        {record.extracted_data?.line_items && record.extracted_data.line_items.length > 0 && <div className="mt-4">
          <p className="mb-2 text-[10px] uppercase tracking-[.1em] text-[#6b756e]">Line items</p>
          <div className="overflow-hidden rounded-xl border border-[#1c211e]/10">
            <div className="grid grid-cols-[1.6fr_.6fr_.7fr_.7fr] gap-2 border-b border-[#1c211e]/10 bg-[#ffffff] px-4 py-2 text-[9px] uppercase tracking-[.1em] text-[#6b756e]"><span>Description</span><span>Qty</span><span>Unit price</span><span>Total</span></div>
            {record.extracted_data.line_items.map((li, i) => <div key={i} className="grid grid-cols-[1.6fr_.6fr_.7fr_.7fr] gap-2 border-b border-[#1c211e]/[.07] px-4 py-2 text-[10px] last:border-0"><span className="truncate">{li.description}</span><span>{li.quantity}</span><span>{li.unit_price}</span><span>{li.total}</span></div>)}
          </div>
        </div>}
      </div>}
      <div className="mt-6 flex items-center justify-between rounded-xl border border-[#006400]/15 bg-[#006400]/[.05] p-3"><div className="flex items-center gap-2 text-[10px] text-[#006400]"><ShieldCheck size={15} /> Edit any field before exporting</div></div>
    </div>
  </>;
}

function Exports({ onExport, hasExtraction }: { onExport: (format: "csv" | "excel") => void; hasExtraction: boolean }) {
  if (!hasExtraction) {
    return <EmptyView icon={FileArchive} title="Exports, ready when you are." body="Process a document first, then export it here as CSV or Excel." action="Go to Overview" onClick={() => {}} />;
  }
  return <div className="flex min-h-[400px] items-center justify-center"><div className="flex gap-3"><button onClick={() => onExport("csv")} className="dm-btn dm-btn-ghost"><Download size={14} /> Export CSV</button><button onClick={() => onExport("excel")} className="dm-btn dm-btn-primary"><Download size={14} /> Export Excel</button></div></div>;
}

function Team({ onToast }: { onToast: (x: string) => void }) {
  return <><div className="flex items-end justify-between"><div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#006400]">Workspace access</span><h2 className="dm-display mt-2 text-3xl tracking-[-.06em]">Your team</h2></div><button onClick={() => onToast("Team invites are not available yet.")} className="dm-btn dm-btn-primary !px-3 !py-2.5"><Plus size={14} /> Invite member</button></div><EmptyView icon={Users} title="Team management is coming soon." body="Invite teammates and manage roles once workspace collaboration ships." action="Notify me" onClick={() => onToast("We'll let you know when this ships.")} /></>;
}

function SettingsView({ onToast }: { onToast: (x: string) => void }) {
  return <><div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#006400]">Workspace controls</span><h2 className="dm-display mt-2 text-3xl tracking-[-.06em]">Settings</h2></div><div className="dm-glass mt-7 max-w-[720px] rounded-2xl p-6"><Setting title="Default export format" detail="Choose the format used by quick exports." value="CSV" onClick={() => onToast("Export format settings are not available yet.")} /><Setting title="Review notifications" detail="Get notified when a document is ready." value="On" onClick={() => onToast("Notification settings are not available yet.")} /><Setting title="API access" detail="Connect DocuMind to your internal systems." value="Manage" onClick={() => onToast("API access is not available yet.")} /></div></>;
}

function Setting({ title, detail, value, onClick }: { title: string; detail: string; value: string; onClick: () => void }) {
  return <div className="flex items-center justify-between gap-4 border-b border-[#1c211e]/10 py-5 first:pt-0 last:border-0 last:pb-0"><div><p className="text-[11px] font-semibold">{title}</p><p className="mt-1 text-[10px] text-[#5f6962]">{detail}</p></div><button onClick={onClick} className="rounded-lg border border-[#1c211e]/15 px-3 py-2 text-[10px] font-bold text-[#006400]">{value}<ChevronDown size={12} className="ml-2 inline" /></button></div>;
}

function EmptyView({ icon: Icon, title, body, action, onClick }: { icon: typeof FileArchive; title: string; body: string; action: string; onClick: () => void }) {
  return <div className="flex min-h-[550px] items-center justify-center"><div className="max-w-[350px] text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#006400]/20 bg-[#e3efe3] text-[#006400]"><Icon size={24} /></span><h2 className="dm-display mt-6 text-2xl tracking-[-.05em]">{title}</h2><p className="mt-3 text-[12px] leading-5 text-[#5f6962]">{body}</p><button onClick={onClick} className="dm-btn dm-btn-primary mt-6">{action}</button></div></div>;
}