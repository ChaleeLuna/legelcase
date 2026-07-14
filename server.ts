import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { google } from "googleapis";
import * as docxTemplates from "docx-templates";
import { Readable } from "stream";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

// Load environment variables from .env.local (if present)
dotenv.config({ path: ".env.local" });

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
const GOOGLE_IMPERSONATE_EMAIL = process.env.GOOGLE_IMPERSONATE_EMAIL || '';
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const GOOGLE_OAUTH_REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_BUCKET = 'legalcase-documents';
const WORD_TEMPLATE_DIR = path.join(process.cwd(), "templates", "word");
const LEGACY_WORD_TEMPLATE_DIR = path.join(process.cwd(), "templates");
const CASE_DEFAULT_HEADERS = ['id', 'taskType', 'receiveDate', 'docNumber', 'source', 'sourceName', 'docState', 'docStateName', 'taskState', 'taskStateName', 'lawyer', 'lawyerName', 'returnDocNumber', 'approvalDocNumber', 'cc_licensePlate', 'cc_driverName', 'cc_ReferenceNumber', 'cc_damageAmount', 'op_ReferenceNumber', 'op_customerName', 'op_OverdueBillStart', 'op_overdueBillEnd', 'op_amount', 'op_details', 'fn_customerName', 'fn_fineType', 'fn_fineTypeName', 'fn_ReferenceNumber', 'fn_OverdueBillStart', 'fn_OverdueBillEnd', 'fn_amount', 'fn_additionalFees', 'fn_details', 'fn_totalAmount', 'fngov_details', 'fngov_customerName', 'fngov_additionalFees', 'fnbtc_details', 'fnbtc_customerName', 'fnbtc_additionalFees', 'fncable_details', 'fncable_customerName', 'fncable_additionalFees', 'notes', 'isArchived', 'isFinish', 'courtDocument'];

const createDocxReport =
  typeof docxTemplates.createReport === "function"
    ? docxTemplates.createReport
    : typeof docxTemplates.default === "function"
      ? docxTemplates.default
      : typeof docxTemplates === "function"
        ? docxTemplates
        : null;

import { generateUniqueFilename, withThaiDateVariants } from './serverUtils.js';

async function resolveWordTemplatePath(taskType: string) {
  const filename = `${String(taskType || "task").trim()}.docx`;
  const candidates = [
    path.join(WORD_TEMPLATE_DIR, filename),
    path.join(LEGACY_WORD_TEMPLATE_DIR, filename),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next candidate path.
    }
  }

  return null;
}

function buildWordDownloadName(caseData: Record<string, any>) {
  let thaiTaskType = caseData.taskType || "task";
  if (thaiTaskType === 'car_crash') thaiTaskType = 'รถยนต์ชนเสา';
  else if (thaiTaskType === 'overdue_payment') thaiTaskType = 'ค่าไฟฟ้าค้างชำระ';
  else if (thaiTaskType === 'fine') thaiTaskType = 'ค่าละเมิดการใช้ไฟฟ้า';

  let customerName = '';
  let caNumbers: string[] = [];

  if (caseData.taskType === 'car_crash') {
    customerName = String(caseData.cc_driverName || caseData.driverName || '').trim();
    if (caseData.cc_ReferenceNumber) caNumbers.push(String(caseData.cc_ReferenceNumber).trim());
    if (caseData.referenceNumber) caNumbers.push(String(caseData.referenceNumber).trim());
  } else if (caseData.taskType === 'overdue_payment') {
    customerName = String(caseData.op_customerName || caseData.driverName || '').trim();
    if (Array.isArray(caseData.op_details) && caseData.op_details.length > 0) {
      caNumbers = caseData.op_details.map((d: any) => String(d.op_ReferenceNumber || '').trim()).filter(Boolean);
    } else {
      if (caseData.op_ReferenceNumber) caNumbers.push(String(caseData.op_ReferenceNumber).trim());
      if (caseData.referenceNumber) caNumbers.push(String(caseData.referenceNumber).trim());
    }
  } else if (caseData.taskType === 'fine') {
    customerName = String(caseData.fn_customerName || caseData.driverName || '').trim();
    if (Array.isArray(caseData.fn_details) && caseData.fn_details.length > 0) {
      caNumbers = caseData.fn_details.map((d: any) => String(d.fn_ReferenceNumber || '').trim()).filter(Boolean);
    } else {
      if (caseData.fn_ReferenceNumber) caNumbers.push(String(caseData.fn_ReferenceNumber).trim());
      if (caseData.referenceNumber) caNumbers.push(String(caseData.referenceNumber).trim());
    }
  } else {
    customerName = String(caseData.docNumber || caseData.id || "case").trim();
  }

  caNumbers = [...new Set(caNumbers)];

  let filename = `ขออนุมัติฟ้อง${thaiTaskType}`;
  if (customerName) {
    const safeCustomer = customerName.replace(/\s+/g, '_');
    filename += `-${safeCustomer}`;
  }
  if (caNumbers.length > 0) {
    filename += `-${caNumbers.join('-')}`;
  }
  filename += `.docx`;

  return encodeURIComponent(filename);
}

// Build a Google Drive auth client — mirrors rclone's auth priority:
//   1. OAuth2 refresh token (personal Gmail)  ← GOOGLE_OAUTH_REFRESH_TOKEN
//   2. JWT impersonation (Google Workspace)   ← GOOGLE_IMPERSONATE_EMAIL
//   3. Plain service account (Shared Drive)   ← fallback
function buildDriveAuth(): any {
  if (GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET && GOOGLE_OAUTH_REFRESH_TOKEN) {
    // rclone "token" style: OAuth2 with a stored refresh token.
    // Works with regular Gmail accounts — no Workspace / Shared Drive needed.
    console.log('Google Drive auth: using OAuth2 refresh token (personal Gmail mode)');
    const oauth2 = new google.auth.OAuth2(
      GOOGLE_OAUTH_CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob' // OOB redirect — same as rclone local auth
    );
    oauth2.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN });
    return oauth2;
  }

  if (!GOOGLE_SERVICE_ACCOUNT_KEY) return null;
  const key = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);

  if (GOOGLE_IMPERSONATE_EMAIL) {
    // rclone --drive-impersonate: JWT with subject (Google Workspace only)
    console.log(`Google Drive auth: impersonating "${GOOGLE_IMPERSONATE_EMAIL}"`);
    return new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/drive'],
      subject: GOOGLE_IMPERSONATE_EMAIL,
    });
  }

  // Fallback: plain service account (works only with Shared Drives)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

// Upload a file buffer to Google Drive and return the public view URL.
async function uploadFileToGoogleDrive(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string | null> {
  const auth = buildDriveAuth();
  if (!auth) {
    console.error('Google Drive upload: no auth credentials configured');
    return null;
  }
  try {
    const drive = google.drive({ version: 'v3', auth });

    console.log(`Google Drive upload: uploading "${fileName}"`);

    const fileMetadata: any = { name: fileName };
    if (GOOGLE_DRIVE_FOLDER_ID) {
      fileMetadata.parents = [GOOGLE_DRIVE_FOLDER_ID];
    }

    const media = {
      mimeType,
      body: Readable.from(fileBuffer), // Chunked/resumable stream upload (rclone style)
    };

    const resp = await drive.files.create({
      requestBody: fileMetadata,
      media,
      supportsAllDrives: true,
      fields: 'id, webViewLink',
    });

    const fileId = resp.data.id;
    if (!fileId) {
      console.error('Google Drive upload failed: No file ID returned');
      return null;
    }
    console.log(`Google Drive upload success: File ID ${fileId}`);

    // Set anyone-with-link read permission so users can open the file in browser
    try {
      await drive.permissions.create({
        fileId,
        supportsAllDrives: true,
        requestBody: { role: 'reader', type: 'anyone' },
      });
      console.log(`Permission set to public for Google Drive file ${fileId}`);
    } catch (permErr: any) {
      console.warn(`Failed to set public permissions for file ${fileId}:`, permErr?.message || permErr);
    }

    return resp.data.webViewLink || null;
  } catch (err: any) {
    console.error('Google Drive upload error:', err?.message || err);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ── Google Drive OAuth flow (rclone-style one-time setup) ──────────────────
  // Step 1: Visit /api/auth/drive  → redirects to Google consent screen
  // Step 2: Google redirects to /api/auth/drive/callback
  // Step 3: Copy the displayed GOOGLE_OAUTH_REFRESH_TOKEN into .env.local
  app.get('/api/auth/drive', (req, res) => {
    if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
      return res.status(400).send(
        'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env.local first.'
      );
    }
    const oauth2 = new google.auth.OAuth2(
      GOOGLE_OAUTH_CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET,
      `http://localhost:3000/api/auth/drive/callback`
    );
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force refresh_token to be returned every time
      scope: ['https://www.googleapis.com/auth/drive'],
    });
    res.redirect(url);
  });

  app.get('/api/auth/drive/callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).send('Missing code parameter');
    try {
      const oauth2 = new google.auth.OAuth2(
        GOOGLE_OAUTH_CLIENT_ID,
        GOOGLE_OAUTH_CLIENT_SECRET,
        `http://localhost:3000/api/auth/drive/callback`
      );
      const { tokens } = await oauth2.getToken(code);
      const refreshToken = tokens.refresh_token;
      res.send(`
        <html><body style="font-family:monospace;padding:32px;background:#f8f9fa">
          <h2>✅ Google Drive Authorization Successful</h2>
          <p>Copy the value below and add it to your <code>.env.local</code>:</p>
          <pre style="background:#fff;border:1px solid #ccc;padding:16px;border-radius:8px">GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken || '(none — re-authorize with prompt=consent)'}</pre>
          <p style="color:#888">You only need to do this once. Restart the server after saving .env.local</p>
        </body></html>
      `);
    } catch (err: any) {
      res.status(500).send(`OAuth callback error: ${err?.message || err}`);
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  // LINE Login - check or register user, return permission
  app.post("/api/auth/line", express.json(), async (req, res) => {
    const { userId, displayName, pictureUrl, statusMessage } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    try {
      const sheets = await getSheetsClient();
      if (!sheets) return res.status(500).json({ error: "Sheets client unavailable" });

      // Read existing users
      let values: any[][] = [];
      try {
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: "User!A:F",
        });
        values = resp.data.values || [];
      } catch {
        // Sheet may not exist yet, will be created on first write
        values = [];
      }

      const headers = values.length > 0 ? values[0] : ["user_id", "account_name", "picture_url", "status_message", "permission", "created_at"];
      const rows = values.slice(1);

      // Find existing user
      const userIdIdx = headers.indexOf("user_id");
      const permIdx = headers.indexOf("permission");
      const existing = rows.find(r => r[userIdIdx] === userId);

      if (existing) {
        const permission = parseInt(existing[permIdx] ?? "0", 10);
        return res.json({ permission, isNew: false });
      }

      // New user - append to sheet
      const now = new Date().toISOString();
      const newRow = headers.map((h: string) => {
        if (h === "user_id") return userId;
        if (h === "account_name") return displayName || "";
        if (h === "picture_url") return pictureUrl || "";
        if (h === "status_message") return statusMessage || "";
        if (h === "permission") return "0";
        if (h === "created_at") return now;
        return "";
      });

      // If sheet is empty, write header first
      if (values.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: "User!A1",
          valueInputOption: "RAW",
          requestBody: { values: [headers, newRow] },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: "User!A:F",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [newRow] },
        });
      }

      return res.json({ permission: 0, isNew: true });
    } catch (err: any) {
      console.error("LINE auth error:", err?.message || err);
      res.status(500).json({ error: "Auth failed" });
    }
  });

  // API for Google Sheets data (falls back to mock data)
  app.get("/api/sheets/:sheetName", async (req, res) => {
    const { sheetName } = req.params;

    // Try service-account auth first (preferred)
    if (GOOGLE_SHEET_ID && GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const key = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
        const auth = new google.auth.GoogleAuth({
          credentials: key,
          scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: "v4", auth });
        // Try multiple range formats to avoid "Unable to parse range" errors
        const rangeCandidates = [
          sheetName,
          `'${sheetName}'`,
          `${sheetName}!A:Z`,
          `'${sheetName}'!A:Z`,
        ];
        let resp: any = null;
        for (const range of rangeCandidates) {
          try {
            console.log("Trying range:", range);
            resp = await sheets.spreadsheets.values.get({
              spreadsheetId: GOOGLE_SHEET_ID,
              range,
            });
            break;
          } catch (err) {
            console.warn("Range failed:", range, err?.message || err);
          }
        }
        if (!resp) throw new Error("All range formats failed");
        const values: string[][] = resp.data.values || [];
        if (values.length === 0) return res.json({ rows: [], options: [], normalized: [] });
        // Map rows to objects keyed by header
        const headers = values[0];
        const rows = values.slice(1).map((row) => {
          const obj: Record<string, string> = {};
          headers.forEach((h: string, i: number) => {
            obj[h] = row[i] ?? "";
          });
          return obj;
        });

        // Build normalized/options for dropdown use (backwards-compatible)
        let normalized: Array<Record<string, string>> = [];
        if (headers.length >= 2) {
          normalized = values.slice(1).map((row, i) => ({
            id: row[0] ?? `${i + 1}`,
            label: row[1] ?? row[0] ?? "",
          }));
        } else if (headers.length === 1) {
          normalized = values.slice(1).map((row, i) => ({ id: `${i + 1}`, label: row[0] ?? "" }));
        }

        return res.json({ rows, options: normalized, normalized });
      } catch (err) {
        console.error("Service account Sheets fetch failed, falling back:", err);
      }
    }

    // If service account not configured, try API key (public sheet)
    if (GOOGLE_SHEET_ID && GOOGLE_API_KEY) {
      try {
        const range = encodeURIComponent(sheetName);
        const rangeCandidates = [
          sheetName,
          `'${sheetName}'`,
          `${sheetName}!A:Z`,
          `'${sheetName}'!A:Z`,
        ];
        let json: any = null;
        for (const r of rangeCandidates) {
          try {
            const encoded = encodeURIComponent(r);
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encoded}?key=${GOOGLE_API_KEY}`;
            console.log("Trying URL range:", r);
            const resp = await fetch(url);
            if (!resp.ok) {
              const text = await resp.text();
              console.warn("Sheets API returned non-ok for range", r, resp.status, text);
              continue;
            }
            json = await resp.json();
            break;
          } catch (err) {
            console.warn("Range URL failed:", r, err?.message || err);
          }
        }
        if (!json) throw new Error("All range formats failed with API key");
        const values: string[][] = json.values || [];
        if (values.length === 0) return res.json({ rows: [], options: [], normalized: [] });
        // Map rows to objects keyed by header
        const headers = values[0];
        const rows = values.slice(1).map((row) => {
          const obj: Record<string, string> = {};
          headers.forEach((h: string, i: number) => {
            obj[h] = row[i] ?? "";
          });
          return obj;
        });

        // Build normalized/options for dropdown use (backwards-compatible)
        let normalized: Array<Record<string, string>> = [];
        if (headers.length >= 2) {
          normalized = values.slice(1).map((row, i) => ({
            id: row[0] ?? `${i + 1}`,
            label: row[1] ?? row[0] ?? "",
          }));
        } else if (headers.length === 1) {
          normalized = values.slice(1).map((row, i) => ({ id: `${i + 1}`, label: row[0] ?? "" }));
        }

        console.log(`Fetched ${rows.length} rows from Google Sheets (api key)`);
        return res.json({ rows, options: normalized, normalized });
      } catch (err) {
        console.error("Failed to fetch sheet with API key, falling back to mock:", err);
      }
    }

    return res.status(500).json({ error: "Unable to fetch sheet data" });
  });

  // Helper: get a Sheets client for service-account access (write/read)
  async function getSheetsClient() {
    if (!GOOGLE_SHEET_ID) return null;
    if (!GOOGLE_SERVICE_ACCOUNT_KEY) return null;
    try {
      const key = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
      const auth = new google.auth.GoogleAuth({
        credentials: key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      await auth.getClient();
      return google.sheets({ version: "v4", auth });
    } catch (err) {
      console.error("getSheetsClient error", err);
      return null;
    }
  }

  // Helper: read header row from a sheet
  async function getSheetHeaders(sheetName: string): Promise<string[]> {
    const sheets = await getSheetsClient();
    if (sheets) {
      try {
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: `${sheetName}!1:1`,
        });
        const values: any[][] = resp.data.values || [];
        return (values[0] || []).map(String);
      } catch (err) {
        console.error("getSheetHeaders error (service account)", err);
      }
    }

    if (GOOGLE_SHEET_ID && GOOGLE_API_KEY) {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(sheetName)}!1:1?key=${GOOGLE_API_KEY}`;
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const json = await resp.json();
        const values: any[][] = json.values || [];
        return (values[0] || []).map(String);
      } catch (err) {
        console.error("getSheetHeaders error (api key)", err);
      }
    }

    return [];
  }

  // Helper: get normalized options for a sheet ([{id,label}])
  async function getSheetOptions(sheetName: string) {
    // Prefer service-account for accurate reads
    const sheets = await getSheetsClient();
    if (sheets) {
      try {
        const range = `${sheetName}!A:AZ`;
        const resp = await sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID!, range });
        const values: string[][] = resp.data.values || [];
        if (values.length === 0) return [];
        const headers = (values[0] || []).map(h => String(h || "").trim().toLowerCase());
        const sourceIdx = headers.indexOf('source');
        if (headers.length >= 2) {
          return values.slice(1).map((row, i) => {
            // For 'source' sheet, we use 1-based index as ID
            const id = (sheetName === 'source') ? String(i + 1) : String(row[0] ?? `${i + 1}`);
            // For 'source' sheet, we always use the 'source' column as the label
            const labelIdx = (sheetName === 'source' && sourceIdx !== -1) ? sourceIdx : 1;
            const label = String(row[labelIdx] ?? row[0] ?? id);
            return { id, label };
          });
        }
        return values.slice(1).map((row, i) => ({ id: String(i + 1), label: String(row[0] ?? "") }));
      } catch (err) {
        console.error('getSheetOptions(service account) error', err);
      }
    }

    // Fallback to API key read-only
    if (GOOGLE_SHEET_ID && GOOGLE_API_KEY) {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${GOOGLE_API_KEY}`;
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const json = await resp.json();
        const values: string[][] = json.values || [];
        if (values.length === 0) return [];
        const headers = (values[0] || []).map(h => String(h || "").trim().toLowerCase());
        const sourceIdx = headers.indexOf('source');
        if (headers.length >= 2) {
          return values.slice(1).map((row, i) => {
            const id = (sheetName === 'source') ? String(i + 1) : String(row[0] ?? `${i + 1}`);
            const labelIdx = (sheetName === 'source' && sourceIdx !== -1) ? sourceIdx : 1;
            const label = String(row[labelIdx] ?? row[0] ?? id);
            return { id, label };
          });
        }
        return values.slice(1).map((row, i) => ({ id: String(i + 1), label: String(row[0] ?? "") }));
      } catch (err) {
        console.error('getSheetOptions(api key) error', err);
      }
    }

    return [];
  }

  // Helper to read a sheet as an array of objects (uses first row as headers)
  async function readSheetAsObjects(sheetName: string) {
    const sheets = await getSheetsClient();
    if (!sheets) return [];

    const range = `${sheetName}!A:AZ`;
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID!,
      range,
    });

    const values: any[][] = resp.data.values || [];
    if (values.length === 0) return [];

    const headers = values[0].map(String);
    return values.slice(1).map((row, idx) => {
      const obj: Record<string, any> = { __rowNum: idx + 2 };
      headers.forEach((h, i) => {
        const raw = row[i] ?? "";
        const key = String(h).trim();
        if (key.toLowerCase() === "isarchived" || key.toLowerCase() === "archived" || key.toLowerCase() === "isfinish") {
          const v = String(raw).trim().toLowerCase();
          obj[key] = v === "true" || v === "1" || v === "yes";
        } else if (['fn_additionalFees','op_details','fn_details','fngov_details','fngov_additionalFees','fnbtc_details','fnbtc_additionalFees','fncable_additionalFees'].includes(key)) {
          // Parse JSON string back to array
          try {
            obj[key] = JSON.parse(String(raw));
          } catch {
            obj[key] = [];
          }
        } else if (key === 'fncable_details') {
          // fncable_details stores {amount, detectedDate} as JSON object
          try {
            const parsed = JSON.parse(String(raw));
            obj[key] = parsed;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              obj['fncable_amount'] = parsed.amount || '';
              obj['fncable_detectedDate'] = parsed.detectedDate || '';
            }
          } catch {
            obj[key] = {};
          }
        } else {
          obj[key] = raw;
        }
      });
      return obj;
    });
  }

  // GET all cases (from sheet)
  app.get("/api/cases", async (req, res) => {
    try {
      const cases = await readSheetAsObjects("case");
      const activeCases = cases.filter(c => !c.isArchived);
      res.json(activeCases);
    } catch (err) {
      console.error("Failed to load cases from sheet:", err);
      res.status(500).json({ error: "Failed to load cases" });
    }
  });

  // GET archived cases
  app.get("/api/cases/archived", async (req, res) => {
    try {
      const cases = await readSheetAsObjects("case");
      const archivedCases = cases.filter(c => c.isArchived);
      res.json(archivedCases);
    } catch (err) {
      console.error("Failed to load archived cases from sheet:", err);
      res.status(500).json({ error: "Failed to load archived cases" });
    }
  });

  app.get("/api/cases/:id/word", async (req, res) => {
    try {
      const cases = await readSheetAsObjects("case");
      const caseData = cases.find(c => String(c.id) === String(req.params.id));

      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      const templatePath = await resolveWordTemplatePath(caseData.taskType);
      if (!templatePath) {
        return res.status(404).json({
          error: `Template not found for task type "${caseData.taskType}"`,
        });
      }

      const template = await fs.readFile(templatePath);
      const templateData = withThaiDateVariants(caseData);

      // Look up source in Google Sheet to attach poa_cc and poa_fn
      try {
        const sourcesRow = await readSheetAsObjects("source");
        const lookupSourceName = String(caseData.sourceName || "").trim();
        const matchedSource = sourcesRow.find((s: any) => {
          const sName = String(s.source || "").trim();
          return sName.toLowerCase() === lookupSourceName.toLowerCase();
        });

        if (matchedSource) {
          templateData.poa_cc = matchedSource.poa_cc || "";
          templateData.poa_fn = matchedSource.poa_fn || "";
        } else {
          templateData.poa_cc = "-";
          templateData.poa_fn = "-";
        }
      } catch (err) {
        console.error("Failed to load source sheet for poa mappings", err);
        templateData.poa_cc = "-";
        templateData.poa_fn = "-";
      }

      const templateExtras = {
        fn_feeItemsBlock: templateData.fn_feeItemsBlock,
        fn_feeItemsText: templateData.fn_feeItemsText,
        fn_feeItemsParagraphs: templateData.fn_feeItemsParagraphs,
        poa_cc: templateData.poa_cc,
        poa_fn: templateData.poa_fn,
      };
      if (typeof createDocxReport !== "function") {
        throw new Error("docx-templates createReport is unavailable");
      }
      console.log('Final Template Data for Word:', {
        source: templateData.source,
        sourceName: templateData.sourceName,
        poa_cc: templateData.poa_cc,
        poa_fn: templateData.poa_fn
      });
      console.log("Template Data :", templateData)
      const report = await createDocxReport({
        template,
        data: templateData,
        additionalJsContext: templateExtras,
        cmdDelimiter: ["{{", "}}"],
        processLineBreaks: true,
        processLineBreaksAsNewText: true,
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${buildWordDownloadName(caseData)}"`);
      return res.send(Buffer.from(report));
    } catch (err) {
      console.error("Failed to generate word document:", err);
      return res.status(500).json({ error: "Failed to generate word document" });
    }
  });

  app.post("/api/cases", upload.array("courtDocuments"), async (req, res) => {
    console.log("Received case data:", req.body);
    if (req.files) {
      console.log("Received files:", (req.files as any[]).map(f => f.originalname));
    }

    try {
      // Determine next numeric ID (based on existing sheet rows)
      const cases = await readSheetAsObjects("case");
      const maxId = cases.reduce((max, c) => {
        const parsed = parseInt(c.id, 10);
        return isNaN(parsed) ? max : Math.max(max, parsed);
      }, 0);
      const newId = String(maxId + 1);

      const newCase: Record<string, any> = {
        id: newId,
        ...req.body,
        isArchived: false,
        isFinish: false,
      };

      // Upload court documents to Google Drive if provided
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const uploadPromises = req.files.map(async (file, index) => {
          let desc = '';
          if (req.body.documentDescriptions) {
            const descriptions = Array.isArray(req.body.documentDescriptions)
              ? req.body.documentDescriptions
              : [req.body.documentDescriptions];
            desc = descriptions[index] || '';
          }
          const displayName = desc || file.originalname;
          const ext = path.extname(file.originalname);
          const baseName = desc || path.basename(file.originalname, ext);
          const uniqueNum = `${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
          const uploadName = `${baseName}-${uniqueNum}${ext}`;
          const url = await uploadFileToGoogleDrive(file.buffer, uploadName, file.mimetype);
          return url ? { name: displayName, url } : null;
        });
        const driveLinks = await Promise.all(uploadPromises);
        const validLinks = driveLinks.filter(Boolean);
        if (validLinks.length > 0) {
          newCase.courtDocument = JSON.stringify(validLinks);
        }
      }

      // Parse JSON array fields back to arrays
      for (const field of ['fn_additionalFees','op_details','fn_details','fngov_details','fngov_additionalFees','fnbtc_details','fnbtc_additionalFees','fncable_details','fncable_additionalFees']) {
        if (typeof newCase[field] === 'string') {
          try { newCase[field] = JSON.parse(newCase[field]); } catch { newCase[field] = []; }
        }
      }

      // Resolve dropdown ids -> labels
      const [sourceOptions, docStateOptions, taskStateOptions, lawyerOptions, fineTypeOptions] = await Promise.all([
        getSheetOptions('source'),
        getSheetOptions('doc_state'),
        getSheetOptions('task_state'),
        getSheetOptions('lawyer'),
        getSheetOptions('fine_type'),
      ]);

      newCase.sourceName = (sourceOptions.find((o: any) => o.id === newCase.source) || {}).label || newCase.sourceName || '';
      newCase.docStateName = (docStateOptions.find((o: any) => o.id === newCase.docState) || {}).label || newCase.docStateName || '';
      newCase.taskStateName = (taskStateOptions.find((o: any) => o.id === newCase.taskState) || {}).label || newCase.taskStateName || '';
      newCase.lawyerName = (lawyerOptions.find((o: any) => o.id === newCase.lawyer) || {}).label || newCase.lawyerName || '';
      newCase.fn_fineTypeName = (fineTypeOptions.find((o: any) => o.id === newCase.fn_fineType) || {}).label || newCase.fn_fineTypeName || '';
      // fn_customerName is direct string in UI


      console.log('Resolved labels before append:', {
        source: newCase.sourceName,
        docState: newCase.docStateName,
        taskState: newCase.taskStateName,
        lawyer: newCase.lawyerName,
        fn_fineType: newCase.fn_fineTypeName,
        fn_customer: newCase.fn_customerName,
      });

      // Append to sheet
      const sheets = await getSheetsClient();
      const headers = await getSheetHeaders('case');
      const effectiveHeaders = headers.length > 0 ? headers : CASE_DEFAULT_HEADERS;
      console.log('Using headers for append:', effectiveHeaders);

      // Convert fn_additionalFees array to JSON string for sheet storage
      const rowData = { ...newCase };
      // Pack fncable scalar fields into fncable_details JSON object
      if (rowData.taskType === 'fine_cable') {
        rowData.fncable_details = JSON.stringify({
          amount: rowData.fncable_amount || '',
          detectedDate: rowData.fncable_detectedDate || ''
        });
      }
      for (const field of ['fn_additionalFees','op_details','fn_details','fngov_details','fngov_additionalFees','fnbtc_details','fnbtc_additionalFees','fncable_additionalFees']) {
        if (Array.isArray(rowData[field])) rowData[field] = rowData[field].length > 0 ? JSON.stringify(rowData[field]) : '';
      }

      const row = effectiveHeaders.map(h => rowData[h] ?? '');
      console.log('Row to append:', row);

      if (sheets) {
        const appendResp = await sheets.spreadsheets.values.append({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: 'case!A:AZ',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [row] }
        });
        console.log('Sheets append response status:', appendResp?.status);
        console.log('Sheets append response data:', appendResp?.data);
      } else if (GOOGLE_API_KEY) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/case!A:AZ:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&key=${GOOGLE_API_KEY}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] })
        });
        const text = await resp.text();
        console.log('API-key append response status:', resp.status, 'body:', text);
      } else {
        console.warn('No Sheets client or API key, cannot append case to sheet');
      }

      res.json({ success: true, message: "บันทึกข้อมูลสำเร็จ", data: newCase });
    } catch (err) {
      console.error('Failed to append case to Google Sheet:', err);
      res.status(500).json({ error: 'Failed to save case' });
    }
  });

  app.put("/api/cases/:id", upload.array("courtDocuments"), async (req, res) => {
    console.log(`Updating case ${req.params.id}:`, req.body);
    if (req.files) {
      console.log("Received file update:", (req.files as any[]).map(f => f.originalname));
    }

    try {
      const updateData: any = { ...req.body };

      // Update in sheet
      const cases = await readSheetAsObjects('case');
      const existing = cases.find(c => String(c.id) === String(req.params.id));
      if (!existing) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // Upload court document to Google Drive if a new file is provided
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const uploadPromises = req.files.map(async (file, index) => {
          let desc = '';
          if (req.body.documentDescriptions) {
            const descriptions = Array.isArray(req.body.documentDescriptions)
              ? req.body.documentDescriptions
              : [req.body.documentDescriptions];
            desc = descriptions[index] || '';
          }
          const displayName = desc || file.originalname;
          const ext = path.extname(file.originalname);
          const baseName = desc || path.basename(file.originalname, ext);
          const uniqueNum = `${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
          const uploadName = `${baseName}-${uniqueNum}${ext}`;
          const url = await uploadFileToGoogleDrive(file.buffer, uploadName, file.mimetype);
          return url ? { name: displayName, url } : null;
        });
        const driveLinks = await Promise.all(uploadPromises);
        const validLinks = driveLinks.filter(Boolean);

        let existingLinks: any[] = [];
        if (updateData.keptDocuments) {
          try { existingLinks = JSON.parse(updateData.keptDocuments); } catch { }
        } else if (existing.courtDocument) {
          try {
            const parsed = JSON.parse(existing.courtDocument);
            existingLinks = Array.isArray(parsed) ? parsed : [];
          } catch {
            const links = existing.courtDocument.split(',').filter(Boolean);
            existingLinks = links.map((url: string) => {
              let name = 'เอกสารแนบ';
              try {
                const filename = decodeURIComponent(url.split('/').pop() || '');
                const match = filename.match(/^(.*?)-[a-z0-9]{12}(\.[^.]+)$/i);
                if (match && match[1]) name = match[1];
                else {
                  const basic = filename.replace(/\.[^/.]+$/, "");
                  name = basic || 'เอกสารแนบ';
                }
              } catch { }
              return { name, url };
            });
          }
        }

        if (validLinks.length > 0 || existingLinks.length > 0) {
          updateData.courtDocument = JSON.stringify([...existingLinks, ...validLinks]);
        } else {
          updateData.courtDocument = '';
        }
      } else if (updateData.keptDocuments) {
        let kept = [];
        try { kept = JSON.parse(updateData.keptDocuments); } catch { }
        updateData.courtDocument = kept.length > 0 ? JSON.stringify(kept) : '';
      }

      // Parse JSON array fields back to arrays
      for (const field of ['fn_additionalFees','op_details','fn_details','fngov_details','fngov_additionalFees','fnbtc_details','fnbtc_additionalFees','fncable_details','fncable_additionalFees']) {
        if (typeof updateData[field] === 'string') {
          try { updateData[field] = JSON.parse(updateData[field]); } catch { updateData[field] = []; }
        }
      }

      // resolve dropdown labels
      const [sourceOptions, docStateOptions, taskStateOptions, lawyerOptions, fineTypeOptions] = await Promise.all([
        getSheetOptions('source'),
        getSheetOptions('doc_state'),
        getSheetOptions('task_state'),
        getSheetOptions('lawyer'),
        getSheetOptions('fine_type'),
      ]);
      if (updateData.source) updateData.sourceName = (sourceOptions.find((o: any) => o.id === updateData.source) || {}).label || updateData.sourceName || '';
      if (updateData.docState) updateData.docStateName = (docStateOptions.find((o: any) => o.id === updateData.docState) || {}).label || updateData.docStateName || '';
      if (updateData.taskState) updateData.taskStateName = (taskStateOptions.find((o: any) => o.id === updateData.taskState) || {}).label || updateData.taskStateName || '';
      if (updateData.lawyer) updateData.lawyerName = (lawyerOptions.find((o: any) => o.id === updateData.lawyer) || {}).label || updateData.lawyerName || '';
      if (updateData.fn_fineType) updateData.fn_fineTypeName = (fineTypeOptions.find((o: any) => o.id === updateData.fn_fineType) || {}).label || updateData.fn_fineTypeName || '';

      const rowNum = existing.__rowNum;
      const headers = await getSheetHeaders('case');
      const effectiveHeaders = headers.length > 0 ? headers : CASE_DEFAULT_HEADERS;
      const updated = { ...existing, ...updateData };

      // Serialize array fields to JSON string for sheet storage
      // Pack fncable scalar fields into fncable_details JSON object
      if ((updated as any).taskType === 'fine_cable') {
        (updated as any).fncable_details = JSON.stringify({
          amount: (updated as any).fncable_amount || '',
          detectedDate: (updated as any).fncable_detectedDate || ''
        });
      }
      for (const field of ['fn_additionalFees','op_details','fn_details','fngov_details','fngov_additionalFees','fnbtc_details','fnbtc_additionalFees','fncable_additionalFees']) {
        if (Array.isArray(updated[field])) updated[field] = updated[field].length > 0 ? JSON.stringify(updated[field]) : '';
      }

      const row = effectiveHeaders.map(h => updated[h] ?? '');

      const sheets = await getSheetsClient();
      if (sheets) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: `case!A${rowNum}:AZ${rowNum}`,
          valueInputOption: 'RAW',
          requestBody: { values: [row] },
        });
      } else if (GOOGLE_API_KEY) {
        const range = `case!A${rowNum}:AZ${rowNum}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW&key=${GOOGLE_API_KEY}`;
        await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] })
        });
      }

      res.json({ success: true, message: "อัปเดตข้อมูลสำเร็จ" });
    } catch (err) {
      console.error('Failed to update case', err);
      res.status(500).json({ error: 'Failed to update case' });
    }
  });

  app.patch("/api/cases/:id/state", express.json(), async (req, res) => {
    const { taskState, taskStateName } = req.body;

    try {
      const cases = await readSheetAsObjects('case');
      const existing = cases.find(c => String(c.id) === String(req.params.id));
      if (!existing) return res.status(404).json({ error: 'Case not found' });

      const updated = { ...existing, taskState, taskStateName } as any;
      const rowNum = existing.__rowNum;
      const headers = await getSheetHeaders('case');
      const effectiveHeaders = headers.length > 0 ? headers : CASE_DEFAULT_HEADERS;

      // Serialize array fields to JSON string for sheet storage
      if ((updated as any).taskType === 'fine_cable') {
        (updated as any).fncable_details = JSON.stringify({
          amount: (updated as any).fncable_amount || '',
          detectedDate: (updated as any).fncable_detectedDate || ''
        });
      }
      for (const field of ['fn_additionalFees','op_details','fn_details','fngov_details','fngov_additionalFees','fnbtc_details','fnbtc_additionalFees','fncable_additionalFees']) {
        if (Array.isArray((updated as any)[field])) (updated as any)[field] = (updated as any)[field].length > 0 ? JSON.stringify((updated as any)[field]) : '';
      }

      const row = effectiveHeaders.map(h => updated[h] ?? '');

      const sheets = await getSheetsClient();
      if (sheets) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: `case!A${rowNum}:AZ${rowNum}`,
          valueInputOption: 'RAW',
          requestBody: { values: [row] },
        });
      } else if (GOOGLE_API_KEY) {
        const range = `case!A${rowNum}:AZ${rowNum}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW&key=${GOOGLE_API_KEY}`;
        await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] })
        });
      }

      res.json({ success: true, message: "อัปเดตสถานะสำเร็จ" });
    } catch (err) {
      console.error('Failed to update case state', err);
      res.status(500).json({ error: 'Failed to update case state' });
    }
  });

  app.patch("/api/cases/:id/archive", express.json(), async (req, res) => {
    const { isFinish } = req.body;
    try {
      const cases = await readSheetAsObjects('case');
      const existing = cases.find(c => String(c.id) === String(req.params.id));
      if (!existing) return res.status(404).json({ error: 'Case not found' });

      const updated = { ...existing, isArchived: true } as any;
      if (isFinish) {
        updated.isFinish = 'TRUE';
      }
      const rowNum = existing.__rowNum;
      const headers = await getSheetHeaders('case');
      const effectiveHeaders = headers.length > 0 ? headers : CASE_DEFAULT_HEADERS;

      // Serialize array fields to JSON string for sheet storage
      if ((updated as any).taskType === 'fine_cable') {
        (updated as any).fncable_details = JSON.stringify({
          amount: (updated as any).fncable_amount || '',
          detectedDate: (updated as any).fncable_detectedDate || ''
        });
      }
      for (const field of ['fn_additionalFees','op_details','fn_details','fngov_details','fngov_additionalFees','fnbtc_details','fnbtc_additionalFees','fncable_additionalFees']) {
        if (Array.isArray((updated as any)[field])) (updated as any)[field] = (updated as any)[field].length > 0 ? JSON.stringify((updated as any)[field]) : '';
      }

      const row = effectiveHeaders.map(h => updated[h] ?? '');

      const sheets = await getSheetsClient();
      if (sheets) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: `case!A${rowNum}:AZ${rowNum}`,
          valueInputOption: 'RAW',
          requestBody: { values: [row] },
        });
      } else if (GOOGLE_API_KEY) {
        const range = `case!A${rowNum}:AZ${rowNum}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW&key=${GOOGLE_API_KEY}`;
        await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] })
        });
      }

      res.json({ success: true, message: "จัดเก็บข้อมูลสำเร็จ" });
    } catch (err) {
      console.error('Failed to archive case', err);
      res.status(500).json({ error: 'Failed to archive case' });
    }
  });

  app.patch("/api/cases/:id/unarchive", express.json(), async (req, res) => {
    try {
      const cases = await readSheetAsObjects('case');
      const existing = cases.find(c => String(c.id) === String(req.params.id));
      if (!existing) return res.status(404).json({ error: 'Case not found' });

      const updated = { ...existing, isArchived: false, isFinish: false } as any;
      const rowNum = existing.__rowNum;
      const headers = await getSheetHeaders('case');
      const effectiveHeaders = headers.length > 0 ? headers : CASE_DEFAULT_HEADERS;

      if ((updated as any).taskType === 'fine_cable') {
        (updated as any).fncable_details = JSON.stringify({
          amount: (updated as any).fncable_amount || '',
          detectedDate: (updated as any).fncable_detectedDate || ''
        });
      }
      for (const field of ['fn_additionalFees','op_details','fn_details','fngov_details','fngov_additionalFees','fnbtc_details','fnbtc_additionalFees','fncable_additionalFees']) {
        if (Array.isArray((updated as any)[field])) (updated as any)[field] = (updated as any)[field].length > 0 ? JSON.stringify((updated as any)[field]) : '';
      }

      const row = effectiveHeaders.map(h => updated[h] ?? '');

      const sheets = await getSheetsClient();
      if (sheets) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: `case!A${rowNum}:AZ${rowNum}`,
          valueInputOption: 'RAW',
          requestBody: { values: [row] },
        });
      } else if (GOOGLE_API_KEY) {
        const range = `case!A${rowNum}:AZ${rowNum}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW&key=${GOOGLE_API_KEY}`;
        await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] })
        });
      }

      res.json({ success: true, message: "ยกเลิกการจัดเก็บสำเร็จ" });
    } catch (err) {
      console.error('Failed to unarchive case', err);
      res.status(500).json({ error: 'Failed to unarchive case' });
    }
  });

  app.delete("/api/cases/:id", async (req, res) => {
    try {
      const cases = await readSheetAsObjects("case");
      const existing = cases.find(c => String(c.id) === String(req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Case not found" });
      }

      const rowNum = existing.__rowNum;

      const sheets = await getSheetsClient();
      if (sheets) {
        // To delete a row, we need the sheetId (not the sheet name)
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: GOOGLE_SHEET_ID!,
        });

        const sheet = spreadsheet.data.sheets?.find(
          (s) => s.properties?.title === "case"
        );

        if (sheet?.properties?.sheetId === undefined) {
          return res.status(500).json({ error: "Could not find sheetId for 'case'" });
        }
        const sheetId = sheet.properties.sheetId;

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: GOOGLE_SHEET_ID!,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: rowNum - 1,
                    endIndex: rowNum,
                  },
                },
              },
            ],
          },
        });

        res.json({ success: true, message: "ลบข้อมูลสำเร็จ" });
      } else {
        res.status(500).json({ error: "Could not connect to Google Sheets to delete." });
      }
    } catch (err) {
      console.error("Failed to delete case:", err);
      res.status(500).json({ error: "Failed to delete case" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
