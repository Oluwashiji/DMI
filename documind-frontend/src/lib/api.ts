/**
 * DocuMind API client.
 *
 * All calls point at VITE_API_URL (see .env.example). Every function here
 * corresponds to a backend endpoint from the DocuMind spec:
 *   POST /auth/signup, POST /auth/login, GET /auth/me
 *   POST /api/extract        (SSE progress: Uploading -> Extracting -> Complete)
 *   GET  /api/exports/csv, GET /api/exports/excel
 *   GET  /api/history
 *
 * Nothing here is mocked - these are real fetch calls. Until the backend
 * exists they will fail with a network error, which callers surface as a
 * toast rather than crashing the UI.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "documind_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // response wasn't JSON - fall back to statusText
    }
    throw new ApiError(detail, res.status);
  }
  return res.json();
}

// ---------- Auth ----------

export interface User {
  id: string;
  email: string;
  full_name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export async function signup(input: { full_name: string; email: string; password: string }) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await handleJson<AuthResponse>(res);
  setToken(data.access_token);
  return data;
}

export async function login(input: { email: string; password: string }) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await handleJson<AuthResponse>(res);
  setToken(data.access_token);
  return data;
}

export async function getMe() {
  const res = await fetch(`${API_URL}/auth/me`, { headers: authHeaders() });
  return handleJson<User>(res);
}

// ---------- Extraction ----------

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ExtractedInvoice {
  vendor_name: string | null;
  date: string | null;
  invoice_number: string | null;
  line_items: LineItem[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  currency: string | null;
}

export interface ExtractionRecord {
  id: string;
  filename: string;
  status: "pending" | "processing" | "complete" | "failed";
  extracted_data: ExtractedInvoice | null;
  created_at: string;
}

export type ExtractStage = "uploading" | "extracting" | "complete" | "error";

export interface ExtractProgressEvent {
  stage: ExtractStage;
  progress: number; // 0-100
  message?: string;
  result?: ExtractionRecord;
}

/**
 * Uploads a file to POST /api/extract and streams progress via SSE.
 * The endpoint is expected to accept multipart/form-data and respond
 * with a `text/event-stream`, emitting JSON-encoded ExtractProgressEvent
 * payloads for each of the three stages (uploading, extracting, complete).
 */
export async function extractDocument(
  file: File,
  onProgress: (event: ExtractProgressEvent) => void,
): Promise<ExtractionRecord> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/api/extract`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (!res.ok || !res.body) {
    throw new ApiError(res.statusText || "Extraction failed to start", res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: ExtractionRecord | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      try {
        const event = JSON.parse(payload) as ExtractProgressEvent;
        onProgress(event);
        if (event.stage === "complete" && event.result) {
          finalResult = event.result;
        }
      } catch {
        // ignore malformed SSE frames
      }
    }
  }

  if (!finalResult) {
    throw new ApiError("Stream ended before extraction completed", 500);
  }
  return finalResult;
}

// ---------- Exports ----------

async function downloadFile(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(extractionId: string, filename = "documind-export.csv") {
  return downloadFile(`/api/exports/csv?extraction_id=${extractionId}`, filename);
}

export function exportExcel(extractionId: string, filename = "documind-export.xlsx") {
  return downloadFile(`/api/exports/excel?extraction_id=${extractionId}`, filename);
}

// ---------- History ----------

export async function getHistory() {
  const res = await fetch(`${API_URL}/api/history`, { headers: authHeaders() });
  return handleJson<ExtractionRecord[]>(res);
}