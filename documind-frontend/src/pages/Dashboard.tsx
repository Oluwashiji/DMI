import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Bell, ChevronDown, CircleHelp, Download, FileArchive, FileCheck2, FileJson, FolderOpen, LayoutDashboard, LogOut, Menu, MoreHorizontal, PanelLeftClose, Plus, Settings, ShieldCheck, SlidersHorizontal, Sparkles, UploadCloud, Users, Zap, Eye, FileText, HardDrive, Image as ImageIcon, Trash2 } from "lucide-react";
import { Brand, StatusPill, Toast } from "../components/shared/Brand";
import "../components/shared/dm.css";
import { useAuth } from "../context/AuthContext";
import {
  ApiError,
  clearFailedExtractions,
  deleteExtraction,
  downloadOriginal,
  exportCsv,
  exportExcel,
  extractDocument,
  getHistory,
  getStorage,
  openOriginal,
  fetchOriginal,
  updateExtraction,
  type ExtractedInvoice,
  type ExtractionRecord,
  type ExtractProgressEvent,
  type StorageUsage,
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

const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];
const MAX_UPLOAD_MB = 10;

/** Quick client-side check so people get an instant, clear message instead of a failed upload. */
function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) return "Upload a PDF, PNG or JPG file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `That file is too large. The limit is ${MAX_UPLOAD_MB} MB.`;
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageDoc(doc: ExtractionRecord): boolean {
  if (doc.content_type) return doc.content_type.startsWith("image/");
  return /\.(png|jpe?g)$/i.test(doc.filename);
}

type PendingDelete = { kind: "one"; record: ExtractionRecord } | { kind: "failed"; count: number };

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
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadStorage = () => {
    getStorage().then(setStorage).catch(() => setStorage(null));
  };

  const loadHistory = () => {
    loadStorage();
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

  const processFile = async (file: File) => {
    if (processing) return;
    const problem = validateFile(file);
    if (problem) {
      setToast(problem);
      return;
    }
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
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Extraction failed. Please try again.";
      setToast(message);
    } finally {
      setProcessing(false);
      loadHistory(); // failed attempts are recorded too, and the storage meter changes
    }
  };

  const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void processFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrop(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
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
    logout(); // the route guard sends deliberate sign-outs to the landing page
    navigate("/", { replace: true });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === "one") {
        await deleteExtraction(pendingDelete.record.id);
        if (activeExtraction?.id === pendingDelete.record.id) {
          setActiveExtraction(null);
          setRows([]);
        }
        setToast("Document deleted.");
      } else {
        const { deleted } = await clearFailedExtractions();
        if (activeExtraction?.status === "failed") {
          setActiveExtraction(null);
          setRows([]);
        }
        setToast(`${deleted} failed upload${deleted === 1 ? "" : "s"} cleared.`);
      }
      setPendingDelete(null);
      loadHistory();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : "Could not delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const viewOriginal = (record: ExtractionRecord) => {
    openOriginal(record.id).catch((err) => setToast(err instanceof ApiError ? err.message : "Could not open the file."));
  };

  const saveOriginal = (record: ExtractionRecord) => {
    downloadOriginal(record.id, record.filename).catch((err) => setToast(err instanceof ApiError ? err.message : "Could not download the file."));
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
      <div className="mt-8 space-y-1">{nav.map(({ label, icon: Icon }) => <button key={label} onClick={() => setView(label as View)} title={label} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[11px] font-semibold transition ${view === label ? "bg-[#f3e3e6] text-[#4A0E1C]" : "text-[#5f6962] hover:bg-[#f8eef0] hover:text-[#1c211e]"}`}><Icon size={16} />{sidebar && label}{sidebar && label === "Documents" && history.length > 0 && <span className="ml-auto rounded-full bg-[#722F37] px-1.5 py-0.5 text-[9px] text-[#ffffff]">{history.length}</span>}</button>)}</div>
      <div className={`${sidebar ? "" : "hidden"} absolute bottom-5 ml-1 flex items-center gap-2`}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#722F37] text-[10px] font-bold text-[#ffffff]">{initials}</span>
        <div><p className="max-w-[110px] truncate text-[10px] font-bold">{user?.full_name ?? user?.email}</p><button onClick={handleLogout} className="flex items-center gap-1 text-[9px] text-[#6b756e] hover:text-[#1c211e]"><LogOut size={10} /> Sign out</button></div>
      </div>
    </aside>
    <section className="min-w-0 flex-1">
      <header className="flex h-[72px] items-center justify-between border-b border-[#1c211e]/10 px-5 md:px-8">
        <div className="flex items-center gap-4"><button onClick={() => setSidebar(!sidebar)} className="hidden text-[#6b756e] md:block"><PanelLeftClose size={17} /></button><div><p className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#6b756e]">Workspace / {view}</p><h1 className="dm-display mt-1 text-lg font-medium tracking-[-.04em]">{view === "Overview" ? `Good to see you, ${user?.full_name?.split(" ")[0] ?? "there"}.` : "Your " + view.toLowerCase()}</h1></div></div>
        <div className="flex items-center gap-3"><button onClick={() => setToast("No new notifications.")} className="relative rounded-lg p-2 text-[#5f6962] hover:bg-[#f8eef0] hover:text-[#1c211e]"><Bell size={17} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#722F37]" /></button><button onClick={() => setToast("Help center is not available yet.")} className="hidden rounded-lg p-2 text-[#5f6962] hover:bg-[#f8eef0] hover:text-[#1c211e] sm:block"><CircleHelp size={17} /></button><span className="h-7 w-px bg-[#1c211e]/10" /><button onClick={handleLogout} className="flex items-center gap-2 text-left"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#722F37] text-[10px] font-bold text-[#ffffff]">{initials}</span><ChevronDown size={14} className="text-[#6b756e]" /></button></div>
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
              <div className="flex items-start justify-between"><div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#4A0E1C]">Process a document</span><h2 className="dm-display mt-2 text-2xl tracking-[-.05em]">Make the next one count.</h2><p className="mt-1 text-[11px] text-[#5f6962]">PDF, PNG or JPG · up to 10 MB</p></div><button onClick={startUpload} className="dm-btn dm-btn-ghost !hidden !px-3 !py-2 sm:!inline-flex"><SlidersHorizontal size={14} /> Configure</button></div>
              <div onClick={startUpload} onDragOver={(e) => { e.preventDefault(); if (!processing) setDrop(true); }} onDragLeave={() => setDrop(false)} onDrop={handleDrop} className={`relative mt-6 flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed ${drop ? "border-[#722F37] bg-[#722F37]/[.08]" : "border-[#1c211e]/20 bg-[#f7f9f7]/60"} transition hover:border-[#722F37]/60`}>
                <div className="absolute left-5 top-5 flex items-center gap-2 text-[9px] uppercase tracking-[.13em] text-[#6b756e]"><span className="h-1.5 w-1.5 rounded-full bg-[#722F37]" /> Secure upload</div>
                {processing ? <>
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#722F37]/30 bg-[#f3e3e6] text-[#4A0E1C]"><UploadCloud size={25} /><span className="absolute inset-[-7px] rounded-full border border-[#722F37]/20" /></div>
                  <p className="mt-5 text-[12px] font-semibold">{stageMessage || "Processing…"}</p>
                  <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-[#ead9dc]"><div style={{ width: `${progress}%` }} className="h-full rounded-full bg-[#722F37] transition-all duration-500" /></div>
                  <span className="dm-mono mt-2 text-[9px] text-[#4A0E1C]">{progress}%</span>
                </> : <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#722F37]/20 bg-[#f3e3e6] text-[#4A0E1C] shadow-[0_0_35px_rgba(114,47,55,.1)]"><UploadCloud size={25} /></div>
                  <p className="mt-5 text-[12px] font-semibold">Drop a document here</p>
                  <p className="mt-2 text-[10px] text-[#5f6962]">or <span className="font-bold text-[#4A0E1C]">browse from your computer</span></p>
                </>}
              </div>
              <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileSelected} />
            </div>
            <div className="dm-glass rounded-2xl p-5 md:p-6"><div className="flex items-center justify-between"><div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#4A0E1C]">At a glance</span><h2 className="dm-display mt-2 text-xl tracking-[-.05em]">This workspace</h2></div><BarChart3 size={18} className="text-[#6b756e]" /></div><div className="mt-7 space-y-3 text-[11px] text-[#56605a]"><p>{history.length} document{history.length === 1 ? "" : "s"} processed so far.</p><p>{history.filter((h) => h.status === "complete").length} ready for review.</p><p>{history.filter((h) => h.status === "failed").length} failed extractions.</p></div></div>
          </div>
          <History docs={history} loading={historyLoading} error={historyError} onOpen={openExtraction} onViewAll={() => setView("Documents")} />
        </>}
        {view === "Documents" && <div className="grid gap-6 xl:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
          <DocumentList docs={history} loading={historyLoading} error={historyError} activeId={activeExtraction?.id ?? null} storage={storage} onOpen={openExtraction} onView={viewOriginal} onDownload={saveOriginal} onDelete={(record) => setPendingDelete({ kind: "one", record })} onClearFailed={() => setPendingDelete({ kind: "failed", count: history.filter((h) => h.status === "failed").length })} onUpload={startUpload} />
          <div className="min-w-0"><Documents record={activeExtraction} rows={rows} setRows={setRows} json={json} setJson={setJson} onExport={handleExport} onToast={setToast} onDelete={(record) => setPendingDelete({ kind: "one", record })} onView={viewOriginal} /></div>
        </div>}
        {view === "Exports" && <Exports onExport={handleExport} hasExtraction={!!activeExtraction} />}
        {view === "Team" && <Team onToast={setToast} />}
        {view === "Settings" && <SettingsView onToast={setToast} />}
      </div>
    </section>
    {pendingDelete && <ConfirmDialog
      title={pendingDelete.kind === "one" ? "Delete this document?" : `Clear ${pendingDelete.count} failed upload${pendingDelete.count === 1 ? "" : "s"}?`}
      body={pendingDelete.kind === "one" ? `"${pendingDelete.record.filename}" and its extracted data will be permanently deleted. This can't be undone.` : "These uploads didn't finish processing. They'll be removed from your library."}
      confirmLabel={pendingDelete.kind === "one" ? "Delete" : "Clear all"}
      busy={deleting}
      onCancel={() => setPendingDelete(null)}
      onConfirm={confirmDelete}
    />}
    {toast && <Toast message={toast} onClose={() => setToast("")} />}
  </main>;
}

function IconAction({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`rounded-lg p-2 text-[#5f6962] transition ${danger ? "hover:bg-[#b3412b]/10 hover:text-[#b3412b]" : "hover:bg-[#f3e3e6] hover:text-[#4A0E1C]"}`}>{children}</button>;
}

function DocumentList({ docs, loading, error, activeId, storage, onOpen, onView, onDownload, onDelete, onClearFailed, onUpload }: { docs: ExtractionRecord[]; loading: boolean; error: string; activeId: string | null; storage: StorageUsage | null; onOpen: (r: ExtractionRecord) => void; onView: (r: ExtractionRecord) => void; onDownload: (r: ExtractionRecord) => void; onDelete: (r: ExtractionRecord) => void; onClearFailed: () => void; onUpload: () => void }) {
  const failed = docs.filter((d) => d.status === "failed").length;
  const pct = storage && storage.limit_bytes > 0 ? Math.min(100, Math.round((storage.used_bytes / storage.limit_bytes) * 100)) : 0;
  const statusLabel = (status: ExtractionRecord["status"]) => (status === "complete" ? "Ready" : status === "failed" ? "Failed" : "Processing");
  return <div className="dm-glass min-w-0 self-start rounded-2xl p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#4A0E1C]">Library</span><h2 className="dm-display mt-1 text-xl tracking-[-.05em]">All documents{docs.length > 0 && <span className="ml-2 text-sm text-[#6b756e]">{docs.length}</span>}</h2></div>
      <div className="flex gap-2">{failed > 0 && <button onClick={onClearFailed} className="dm-btn dm-btn-ghost !px-3 !py-2"><Trash2 size={13} /> Clear failed ({failed})</button>}<button onClick={onUpload} className="dm-btn dm-btn-primary !px-3 !py-2"><Plus size={13} /> Upload</button></div>
    </div>
    {storage && <div className="mt-4" aria-label="Storage used"><div className="flex items-center justify-between text-[9px] text-[#5f6962]"><span className="flex items-center gap-1"><HardDrive size={11} /> Storage</span><span>{formatBytes(storage.used_bytes)} of {formatBytes(storage.limit_bytes)}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#ead9dc]"><div style={{ width: `${pct}%` }} className={`h-full rounded-full ${pct >= 90 ? "bg-[#b3412b]" : "bg-[#722F37]"}`} /></div></div>}
    <div className="mt-5 divide-y divide-[#1c211e]/[.07] overflow-hidden rounded-xl border border-[#1c211e]/10 bg-[#ffffff]">
      {loading && docs.length === 0 && <div className="px-5 py-8 text-center text-[11px] text-[#6b756e]">Loading documents…</div>}
      {!loading && error && <div className="px-5 py-8 text-center text-[11px] text-[#b3412b]">{error}</div>}
      {!loading && !error && docs.length === 0 && <div className="px-5 py-10 text-center"><p className="text-[11px] font-semibold">No documents yet</p><p className="mt-1 text-[10px] text-[#5f6962]">Upload a PDF, PNG or JPG invoice and it will be kept here.</p></div>}
      {docs.map((doc) => {
        const Icon = isImageDoc(doc) ? ImageIcon : FileText;
        const meta = [doc.extracted_data?.vendor_name, doc.file_size != null ? formatBytes(doc.file_size) : null, new Date(doc.created_at).toLocaleDateString()].filter(Boolean).join(" · ");
        return <div key={doc.id} className={`flex items-center gap-2 px-3 py-3 transition ${doc.id === activeId ? "bg-[#f3e3e6]/60" : "hover:bg-[#f8eef0]/60"}`}>
          <button type="button" onClick={() => onOpen(doc)} aria-label={`Open ${doc.filename}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f3e3e6] text-[#4A0E1C]"><Icon size={16} /></span>
            <span className="min-w-0"><span className="block truncate text-[11px] font-semibold">{doc.filename}</span><span className="block truncate text-[9px] text-[#5f6962]">{meta}</span></span>
          </button>
          <span className={`dm-mono hidden shrink-0 text-[9px] sm:block ${doc.status === "failed" ? "text-[#b3412b]" : "text-[#4A0E1C]"}`}>{statusLabel(doc.status)}</span>
          <div className="flex shrink-0 items-center">
            {doc.has_file && <><IconAction label={`View original ${doc.filename}`} onClick={() => onView(doc)}><Eye size={14} /></IconAction><IconAction label={`Download original ${doc.filename}`} onClick={() => onDownload(doc)}><Download size={14} /></IconAction></>}
            <IconAction label={`Delete ${doc.filename}`} danger onClick={() => onDelete(doc)}><Trash2 size={14} /></IconAction>
          </div>
        </div>;
      })}
    </div>
  </div>;
}

/** Shows the original upload next to its extracted data, so people can verify the AI's work. */
function OriginalPreview({ record, onView }: { record: ExtractionRecord; onView: (r: ExtractionRecord) => void }) {
  const [open, setOpen] = useState(true);
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    if (!record.has_file || !open) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchOriginal(record.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ id: record.id, url: objectUrl });
      })
      .catch((err) => {
        if (!cancelled) setFailed({ id: record.id, message: err instanceof ApiError ? err.message : "Could not load the original file." });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record.id, record.has_file, open]);

  if (!record.has_file) {
    return <div className="mt-7 rounded-2xl border border-dashed border-[#1c211e]/15 p-4 text-[10px] text-[#5f6962]">The original file isn't stored for this document (it was uploaded before file storage was added).</div>;
  }
  const url = loaded?.id === record.id ? loaded.url : null;
  const error = failed?.id === record.id ? failed.message : "";
  const isImage = record.content_type?.startsWith("image/") ?? false;
  return <div className="mt-7 dm-glass rounded-2xl p-5 md:p-6">
    <div className="flex items-center justify-between gap-3"><div><span className="dm-mono text-[9px] uppercase tracking-[.14em] text-[#4A0E1C]">Original document</span><p className="mt-1 text-[10px] text-[#5f6962]">Compare the source with the fields below{record.file_size != null && ` · ${formatBytes(record.file_size)}`}</p></div><button onClick={() => setOpen(!open)} className="rounded-lg border border-[#1c211e]/15 px-3 py-2 text-[10px] font-bold text-[#4A0E1C]">{open ? "Hide" : "Show"}</button></div>
    {open && <div className="mt-4">
      {error && <p className="text-[10px] text-[#b3412b]">{error}</p>}
      {!error && !url && <p className="py-10 text-center text-[10px] text-[#6b756e]">Loading preview…</p>}
      {url && (isImage
        ? <img src={url} alt={`Original upload: ${record.filename}`} className="mx-auto max-h-[420px] w-auto max-w-full rounded-xl border border-[#1c211e]/10 bg-white object-contain" />
        : <><iframe src={url} title={`Original upload: ${record.filename}`} className="h-[420px] w-full rounded-xl border border-[#1c211e]/10 bg-white" /><button onClick={() => onView(record)} className="mt-3 text-[10px] font-bold text-[#4A0E1C]">Open in a new tab →</button></>)}
    </div>}
  </div>;
}

function ConfirmDialog({ title, body, confirmLabel, busy, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!busy) onCancel(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="dm-confirm-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-[380px] rounded-2xl bg-[#ffffff] p-6 shadow-2xl">
      <h3 id="dm-confirm-title" className="dm-display text-xl tracking-[-.05em]">{title}</h3>
      <p className="mt-3 text-[11px] leading-5 text-[#5f6962]">{body}</p>
      <div className="mt-6 flex justify-end gap-2"><button autoFocus onClick={onCancel} disabled={busy} className="dm-btn dm-btn-ghost !px-4 !py-2.5">Cancel</button><button onClick={onConfirm} disabled={busy} className="dm-btn !bg-[#b3412b] !px-4 !py-2.5 !text-[#ffffff]">{busy ? "Deleting…" : confirmLabel}</button></div>
    </div>
  </div>;
}

function Stat({ title, value, note, icon: Icon, gold = false }: { title: string; value: string; note: string; icon: typeof Zap; gold?: boolean }) {
  return <div className="dm-glass rounded-2xl p-5"><div className="flex items-center justify-between"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${gold ? "bg-[#722F37]/10 text-[#4A0E1C]" : "bg-[#722F37]/[.08] text-[#4A0E1C]"}`}><Icon size={15} /></span><MoreHorizontal size={16} className="text-[#6b756e]" /></div><p className="mt-5 text-[10px] text-[#5f6962]">{title}</p><p className="dm-display mt-1 truncate text-3xl tracking-[-.06em]">{value}</p><p className="mt-2 truncate text-[10px] text-[#4A0E1C]">{note}</p></div>;
}

function History({ docs, loading, error, onOpen, onViewAll }: { docs: ExtractionRecord[]; loading: boolean; error: string; onOpen: (r: ExtractionRecord) => void; onViewAll: () => void }) {
  return <div className="mt-8">
    <div className="mb-4 flex items-center justify-between"><div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#6b756e]">Your activity</span><h2 className="dm-display mt-1 text-xl tracking-[-.05em]">Recent documents</h2></div><button onClick={onViewAll} className="text-[10px] font-bold text-[#4A0E1C]">View all <span className="ml-1">→</span></button></div>
    <div className="overflow-hidden rounded-2xl border border-[#1c211e]/10 bg-[#ffffff]">
      <div className="grid grid-cols-[1.4fr_1fr_.7fr_.65fr_.5fr_auto] gap-3 border-b border-[#1c211e]/10 px-5 py-3 text-[9px] uppercase tracking-[.1em] text-[#6b756e]"><span>Document</span><span>Vendor</span><span>Total</span><span>Uploaded</span><span>Status</span><span /></div>
      {loading && <div className="px-5 py-8 text-center text-[11px] text-[#6b756e]">Loading history…</div>}
      {!loading && error && <div className="px-5 py-8 text-center text-[11px] text-[#b3412b]">{error}</div>}
      {!loading && !error && docs.length === 0 && <div className="px-5 py-8 text-center text-[11px] text-[#6b756e]">No documents processed yet. Upload one to get started.</div>}
      {!loading && !error && docs.map((doc) => <button key={doc.id} onClick={() => onOpen(doc)} className="dm-table-row grid w-full grid-cols-[1.4fr_1fr_.7fr_.65fr_.5fr_auto] items-center gap-3 border-b border-[#1c211e]/[.07] px-5 py-4 text-left last:border-0">
        <span className="flex min-w-0 items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#f3e3e6] text-[#4A0E1C]"><FileCheck2 size={14} /></span><span className="truncate text-[10px] font-semibold">{doc.filename}</span></span>
        <span className="truncate text-[10px] text-[#56605a]">{doc.extracted_data?.vendor_name ?? "-"}</span>
        <span className="text-[10px] text-[#4A0E1C]">{doc.extracted_data?.total != null ? `${doc.extracted_data.currency ?? ""} ${doc.extracted_data.total}`.trim() : "-"}</span>
        <span className="text-[9px] text-[#5f6962]">{new Date(doc.created_at).toLocaleDateString()}</span>
        <span className="dm-mono text-[9px] text-[#4A0E1C]">{doc.status}</span>
        <MoreHorizontal size={14} className="text-[#6b756e]" />
      </button>)}
    </div>
  </div>;
}

function Documents({ record, rows, setRows, json, setJson, onExport, onToast, onDelete, onView }: { record: ExtractionRecord | null; rows: EditableRow[]; setRows: (r: EditableRow[]) => void; json: boolean; setJson: (v: boolean) => void; onExport: (format: "csv" | "excel") => void; onToast: (x: string) => void; onDelete: (r: ExtractionRecord) => void; onView: (r: ExtractionRecord) => void }) {
  if (!record) {
    return <EmptyView icon={FolderOpen} title="No document open yet." body="Pick a document from your library to review its extracted data here, or upload a new one." action="How to upload" onClick={() => onToast("Use \"New document\" in the sidebar to upload.")} />;
  }
  return <>
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#4A0E1C]">Review workspace</span><h2 className="dm-display mt-2 text-3xl tracking-[-.06em]">{record.filename}</h2><p className="mt-2 text-[11px] text-[#5f6962]">{record.extracted_data?.vendor_name ?? "Vendor unknown"} · Uploaded {new Date(record.created_at).toLocaleString()}</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => onDelete(record)} className="dm-btn dm-btn-ghost !px-3 !py-2.5 !text-[#b3412b]" aria-label="Delete document"><Trash2 size={14} /> Delete</button>{record.has_file && <button onClick={() => onView(record)} className="dm-btn dm-btn-ghost !px-3 !py-2.5"><Eye size={14} /> Original</button>}<button onClick={() => setJson(!json)} className="dm-btn dm-btn-ghost !px-3 !py-2.5"><FileJson size={14} />{json ? "Fields" : "JSON"}</button><button onClick={() => onExport("csv")} className="dm-btn dm-btn-ghost !px-3 !py-2.5"><Download size={14} /> CSV</button><button onClick={() => onExport("excel")} className="dm-btn dm-btn-primary !px-3 !py-2.5"><Download size={14} /> Excel</button></div>
    </div>
    <OriginalPreview record={record} onView={onView} />
    <div className="mt-7 dm-glass rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between border-b border-[#1c211e]/10 pb-5"><div><span className="dm-mono text-[9px] uppercase tracking-[.14em] text-[#4A0E1C]">Extracted data</span><h3 className="dm-display mt-2 text-xl tracking-[-.05em]">{json ? "JSON preview" : "Editable fields"}</h3></div><StatusPill>{record.status === "complete" ? "Ready for review" : record.status}</StatusPill></div>
      {json ? <pre className="dm-mono mt-5 overflow-auto rounded-xl bg-[#f5f7f5] p-5 text-[10px] leading-6 text-[#4A0E1C]">{JSON.stringify(record.extracted_data, null, 2)}</pre> : <div className="mt-5 space-y-2">
        {rows.map((r, i) => <div key={r.field} className="grid grid-cols-[.7fr_1fr] items-center gap-3 border-b border-[#1c211e]/[.08] py-3"><p className="text-[10px] text-[#5f6962]">{r.field}</p><input value={r.value} onChange={(e) => setRows(rows.map((item, idx) => (idx === i ? { ...item, value: e.target.value } : item)))} className="dm-input" /></div>)}
        {record.extracted_data?.line_items && record.extracted_data.line_items.length > 0 && <div className="mt-4">
          <p className="mb-2 text-[10px] uppercase tracking-[.1em] text-[#6b756e]">Line items</p>
          <div className="overflow-hidden rounded-xl border border-[#1c211e]/10">
            <div className="grid grid-cols-[1.6fr_.6fr_.7fr_.7fr] gap-2 border-b border-[#1c211e]/10 bg-[#ffffff] px-4 py-2 text-[9px] uppercase tracking-[.1em] text-[#6b756e]"><span>Description</span><span>Qty</span><span>Unit price</span><span>Total</span></div>
            {record.extracted_data.line_items.map((li, i) => <div key={i} className="grid grid-cols-[1.6fr_.6fr_.7fr_.7fr] gap-2 border-b border-[#1c211e]/[.07] px-4 py-2 text-[10px] last:border-0"><span className="truncate">{li.description}</span><span>{li.quantity}</span><span>{li.unit_price}</span><span>{li.total}</span></div>)}
          </div>
        </div>}
      </div>}
      <div className="mt-6 flex items-center justify-between rounded-xl border border-[#722F37]/15 bg-[#722F37]/[.05] p-3"><div className="flex items-center gap-2 text-[10px] text-[#4A0E1C]"><ShieldCheck size={15} /> Edit any field before exporting</div></div>
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
  return <><div className="flex items-end justify-between"><div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#4A0E1C]">Workspace access</span><h2 className="dm-display mt-2 text-3xl tracking-[-.06em]">Your team</h2></div><button onClick={() => onToast("Team invites are not available yet.")} className="dm-btn dm-btn-primary !px-3 !py-2.5"><Plus size={14} /> Invite member</button></div><EmptyView icon={Users} title="Team management is coming soon." body="Invite teammates and manage roles once workspace collaboration ships." action="Notify me" onClick={() => onToast("We'll let you know when this ships.")} /></>;
}

function SettingsView({ onToast }: { onToast: (x: string) => void }) {
  return <><div><span className="dm-mono text-[9px] uppercase tracking-[.16em] text-[#4A0E1C]">Workspace controls</span><h2 className="dm-display mt-2 text-3xl tracking-[-.06em]">Settings</h2></div><div className="dm-glass mt-7 max-w-[720px] rounded-2xl p-6"><Setting title="Default export format" detail="Choose the format used by quick exports." value="CSV" onClick={() => onToast("Export format settings are not available yet.")} /><Setting title="Review notifications" detail="Get notified when a document is ready." value="On" onClick={() => onToast("Notification settings are not available yet.")} /><Setting title="API access" detail="Connect DocuMind to your internal systems." value="Manage" onClick={() => onToast("API access is not available yet.")} /></div></>;
}

function Setting({ title, detail, value, onClick }: { title: string; detail: string; value: string; onClick: () => void }) {
  return <div className="flex items-center justify-between gap-4 border-b border-[#1c211e]/10 py-5 first:pt-0 last:border-0 last:pb-0"><div><p className="text-[11px] font-semibold">{title}</p><p className="mt-1 text-[10px] text-[#5f6962]">{detail}</p></div><button onClick={onClick} className="rounded-lg border border-[#1c211e]/15 px-3 py-2 text-[10px] font-bold text-[#4A0E1C]">{value}<ChevronDown size={12} className="ml-2 inline" /></button></div>;
}

function EmptyView({ icon: Icon, title, body, action, onClick }: { icon: typeof FileArchive; title: string; body: string; action: string; onClick: () => void }) {
  return <div className="flex min-h-[550px] items-center justify-center"><div className="max-w-[350px] text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#722F37]/20 bg-[#f3e3e6] text-[#4A0E1C]"><Icon size={24} /></span><h2 className="dm-display mt-6 text-2xl tracking-[-.05em]">{title}</h2><p className="mt-3 text-[12px] leading-5 text-[#5f6962]">{body}</p><button onClick={onClick} className="dm-btn dm-btn-primary mt-6">{action}</button></div></div>;
}