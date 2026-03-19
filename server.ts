import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { google } from "googleapis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

// Load environment variables from .env.local (if present)
dotenv.config({ path: ".env.local" });

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
        const range = `${sheetName}!A:AE`;
        const resp = await sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID!, range });
        const values: string[][] = resp.data.values || [];
        if (values.length === 0) return [];
        const headers = values[0];
        if (headers.length >= 2) {
          return values.slice(1).map((row, i) => ({ id: String(row[0] ?? `${i + 1}`), label: String(row[1] ?? row[0] ?? "") }));
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
        const headers = values[0];
        if (headers.length >= 2) {
          return values.slice(1).map((row, i) => ({ id: String(row[0] ?? `${i + 1}`), label: String(row[1] ?? row[0] ?? "") }));
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

    const range = `${sheetName}!A:AE`;
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
        if (key.toLowerCase() === "isarchived" || key.toLowerCase() === "archived") {
          const v = String(raw).trim().toLowerCase();
          obj[key] = v === "true" || v === "1" || v === "yes";
        } else if (key === "fn_additionalFees") {
          // Parse JSON string back to array
          try {
            obj[key] = JSON.parse(String(raw));
          } catch {
            obj[key] = [];
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
      res.json(cases);
    } catch (err) {
      console.error("Failed to load cases from sheet:", err);
      res.status(500).json({ error: "Failed to load cases" });
    }
  });

  app.post("/api/cases", upload.single("courtDocument"), async (req, res) => {
    console.log("Received case data:", req.body);
    if (req.file) {
      console.log("Received file:", req.file.originalname);
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
      };

      // Parse fn_additionalFees JSON string back to array
      if (typeof newCase.fn_additionalFees === 'string') {
        try {
          newCase.fn_additionalFees = JSON.parse(newCase.fn_additionalFees);
        } catch {
          newCase.fn_additionalFees = [];
        }
      }

      // Resolve dropdown ids -> labels
      const [sourceOptions, docStateOptions, taskStateOptions, lawyerOptions, fineTypeOptions, customerOptions] = await Promise.all([
        getSheetOptions('source'),
        getSheetOptions('doc_state'),
        getSheetOptions('task_state'),
        getSheetOptions('lawyer'),
        getSheetOptions('fine_type'),
        getSheetOptions('customer'),
      ]);

      newCase.sourceName = (sourceOptions.find((o:any) => o.id === newCase.source) || {}).label || newCase.sourceName || '';
      newCase.docStateName = (docStateOptions.find((o:any) => o.id === newCase.docState) || {}).label || newCase.docStateName || '';
      newCase.taskStateName = (taskStateOptions.find((o:any) => o.id === newCase.taskState) || {}).label || newCase.taskStateName || '';
      newCase.lawyerName = (lawyerOptions.find((o:any) => o.id === newCase.lawyer) || {}).label || newCase.lawyerName || '';
      newCase.fn_fineTypeName = (fineTypeOptions.find((o:any) => o.id === newCase.fn_fineType) || {}).label || newCase.fn_fineTypeName || '';
      newCase.fn_customerName = (customerOptions.find((o:any) => o.id === newCase.fn_customer) || {}).label || newCase.fn_customerName || '';

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
      const defaultHeaders = ['id','taskType','receiveDate','docNumber','source','sourceName','docState','docStateName','taskState','taskStateName','lawyer','lawyerName','returnDocNumber','cc_licensePlate','cc_driverName','cc_ReferenceNumber','cc_damageAmount','op_ReferenceNumber','op_customerName','fn_customerName','op_OverdueBillStart','op_overdueBillEnd','op_amount','fn_fineType','fn_fineTypeName','fn_ReferenceNumber','fn_OverdueBillStart','fn_OverdueBillEnd','fn_amount','fn_additionalFees','fn_totalAmount','notes','isArchived'];
      const effectiveHeaders = headers.length > 0 ? headers : defaultHeaders;
      console.log('Using headers for append:', effectiveHeaders);
      
      // Convert fn_additionalFees array to JSON string for sheet storage
      const rowData = { ...newCase };
      if (Array.isArray(rowData.fn_additionalFees)) {
        rowData.fn_additionalFees = JSON.stringify(rowData.fn_additionalFees);
      }
      
      const row = effectiveHeaders.map(h => rowData[h] ?? '');
      console.log('Row to append:', row);

      if (sheets) {
        const appendResp = await sheets.spreadsheets.values.append({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: 'case!A:AE',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [row] }
        });
        console.log('Sheets append response status:', appendResp?.status);
        console.log('Sheets append response data:', appendResp?.data);
      } else if (GOOGLE_API_KEY) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/case!A:AE:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&key=${GOOGLE_API_KEY}`;
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

  app.put("/api/cases/:id", upload.single("courtDocument"), async (req, res) => {
    console.log(`Updating case ${req.params.id}:`, req.body);
    if (req.file) {
      console.log("Received file update:", req.file.originalname);
    }

    try {
      const updateData: any = { ...req.body };

      // Parse fn_additionalFees JSON string back to array
      if (typeof updateData.fn_additionalFees === 'string') {
        try {
          updateData.fn_additionalFees = JSON.parse(updateData.fn_additionalFees);
        } catch {
          updateData.fn_additionalFees = [];
        }
      }

      // resolve dropdown labels
      const [sourceOptions, docStateOptions, taskStateOptions, lawyerOptions, fineTypeOptions, customerOptions] = await Promise.all([
        getSheetOptions('source'),
        getSheetOptions('doc_state'),
        getSheetOptions('task_state'),
        getSheetOptions('lawyer'),
        getSheetOptions('fine_type'),
        getSheetOptions('customer'),
      ]);
      if (updateData.source) updateData.sourceName = (sourceOptions.find((o:any) => o.id === updateData.source) || {}).label || updateData.sourceName || '';
      if (updateData.docState) updateData.docStateName = (docStateOptions.find((o:any) => o.id === updateData.docState) || {}).label || updateData.docStateName || '';
      if (updateData.taskState) updateData.taskStateName = (taskStateOptions.find((o:any) => o.id === updateData.taskState) || {}).label || updateData.taskStateName || '';
      if (updateData.lawyer) updateData.lawyerName = (lawyerOptions.find((o:any) => o.id === updateData.lawyer) || {}).label || updateData.lawyerName || '';
      if (updateData.fn_fineType) updateData.fn_fineTypeName = (fineTypeOptions.find((o:any) => o.id === updateData.fn_fineType) || {}).label || updateData.fn_fineTypeName || '';
      if (updateData.fn_customer) updateData.fn_customerName = (customerOptions.find((o:any) => o.id === updateData.fn_customer) || {}).label || updateData.fn_customerName || '';
      if (updateData.fn_customer) updateData.fn_customerName = (customerOptions.find((o:any) => o.id === updateData.fn_customer) || {}).label || updateData.fn_customerName || '';

      // Update in sheet
      const cases = await readSheetAsObjects('case');
      const existing = cases.find(c => String(c.id) === String(req.params.id));
      if (!existing) {
        return res.status(404).json({ error: 'Case not found' });
      }
      const rowNum = existing.__rowNum;
      const headers = await getSheetHeaders('case');
      const defaultHeaders = ['id','taskType','receiveDate','docNumber','source','sourceName','docState','docStateName','taskState','taskStateName','lawyer','lawyerName','returnDocNumber','cc_licensePlate','cc_driverName','cc_ReferenceNumber','cc_damageAmount','op_ReferenceNumber','op_customerName','fn_customerName','op_OverdueBillStart','op_overdueBillEnd','op_amount','fn_fineType','fn_fineTypeName','fn_ReferenceNumber','fn_OverdueBillStart','fn_OverdueBillEnd','fn_amount','fn_additionalFees','fn_totalAmount','notes','isArchived'];
      const effectiveHeaders = headers.length > 0 ? headers : defaultHeaders;
      const updated = { ...existing, ...updateData };
      
      // Convert fn_additionalFees array to JSON string for sheet storage
      if (Array.isArray(updated.fn_additionalFees)) {
        updated.fn_additionalFees = JSON.stringify(updated.fn_additionalFees);
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
      const defaultHeaders = ['id','taskType','receiveDate','docNumber','source','sourceName','docState','docStateName','taskState','taskStateName','lawyer','lawyerName','returnDocNumber','cc_licensePlate','cc_driverName','cc_ReferenceNumber','cc_damageAmount','op_ReferenceNumber','op_customerName','fn_customerName','op_OverdueBillStart','op_overdueBillEnd','op_amount','fn_fineType','fn_fineTypeName','fn_ReferenceNumber','fn_OverdueBillStart','fn_OverdueBillEnd','fn_amount','fn_additionalFees','fn_totalAmount','notes','isArchived'];
      const effectiveHeaders = headers.length > 0 ? headers : defaultHeaders;
      
      // Convert fn_additionalFees array to JSON string if present
      if (Array.isArray(updated.fn_additionalFees)) {
        updated.fn_additionalFees = JSON.stringify(updated.fn_additionalFees);
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
    try {
      const cases = await readSheetAsObjects('case');
      const existing = cases.find(c => String(c.id) === String(req.params.id));
      if (!existing) return res.status(404).json({ error: 'Case not found' });

      const updated = { ...existing, isArchived: true } as any;
      const rowNum = existing.__rowNum;
      const headers = await getSheetHeaders('case');
      const defaultHeaders = ['id','taskType','receiveDate','docNumber','source','sourceName','docState','docStateName','taskState','taskStateName','lawyer','lawyerName','returnDocNumber','cc_licensePlate','cc_driverName','cc_ReferenceNumber','cc_damageAmount','op_ReferenceNumber','op_customerName','fn_customerName','op_OverdueBillStart','op_overdueBillEnd','op_amount','fn_fineType','fn_fineTypeName','fn_ReferenceNumber','fn_OverdueBillStart','fn_OverdueBillEnd','fn_amount','fn_additionalFees','fn_totalAmount','notes','isArchived'];
      const effectiveHeaders = headers.length > 0 ? headers : defaultHeaders;
      
      // Convert fn_additionalFees array to JSON string if present
      if (Array.isArray(updated.fn_additionalFees)) {
        updated.fn_additionalFees = JSON.stringify(updated.fn_additionalFees);
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
