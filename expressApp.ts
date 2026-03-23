import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { google } from "googleapis";

const upload = multer({ storage: multer.memoryStorage() });

dotenv.config({ path: ".env.local" });

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const SUPABASE_BUCKET = "legalcase-documents";

function generateUniqueFilename(originalName: string, taskType: string, docNumber: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const date = `${year}-${month}-${day}`;

  const uniqueCode = Math.random().toString(36).substring(2, 8);

  const extension = path.extname(originalName);
  const sanitizedTaskType = String(taskType || "task").replace(/[^a-zA-Z0-9._-]/g, "_");
  const sanitizedDocNumber = String(docNumber || "doc").replace(/[^a-zA-Z0-9._-]/g, "_");

  const newName = `${sanitizedTaskType}-${sanitizedDocNumber}-${date}-${uniqueCode}${extension}`;

  return `${year}/${newName}`;
}

async function uploadFileToSupabase(fileBuffer: Buffer, filePath: string, mimeType: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Supabase upload: SUPABASE_URL or SUPABASE_SERVICE_KEY not set");
    return null;
  }
  try {
    console.log(`Supabase upload: uploading "${filePath}" to bucket "${SUPABASE_BUCKET}"`);

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${filePath}`;
    const resp = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": mimeType,
        "x-upsert": "true",
      },
      body: new Uint8Array(fileBuffer),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Supabase upload failed:", resp.status, text);
      return null;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${filePath}`;
    console.log("Supabase upload success:", publicUrl);
    return publicUrl;
  } catch (err: any) {
    console.error("Supabase upload error:", err?.message || err);
    return null;
  }
}

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

async function getSheetOptions(sheetName: string) {
  const sheets = await getSheetsClient();
  if (sheets) {
    try {
      const range = `${sheetName}!A:AZ`;
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID!, range });
      const values: string[][] = resp.data.values || [];
      if (values.length === 0) return [];
      const headers = values[0];
      if (headers.length >= 2) {
        return values.slice(1).map((row, i) => ({
          id: String(row[0] ?? `${i + 1}`),
          label: String(row[1] ?? row[0] ?? ""),
        }));
      }
      return values.slice(1).map((row, i) => ({ id: String(i + 1), label: String(row[0] ?? "") }));
    } catch (err) {
      console.error("getSheetOptions(service account) error", err);
    }
  }

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
        return values.slice(1).map((row, i) => ({
          id: String(row[0] ?? `${i + 1}`),
          label: String(row[1] ?? row[0] ?? ""),
        }));
      }
      return values.slice(1).map((row, i) => ({ id: String(i + 1), label: String(row[0] ?? "") }));
    } catch (err) {
      console.error("getSheetOptions(api key) error", err);
    }
  }

  return [];
}

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
      } else if (key === "fn_additionalFees") {
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

function createApplication(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/auth/line", express.json(), async (req, res) => {
    const { userId, displayName, pictureUrl, statusMessage } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    try {
      const sheets = await getSheetsClient();
      if (!sheets) return res.status(500).json({ error: "Sheets client unavailable" });

      let values: any[][] = [];
      try {
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: "User!A:F",
        });
        values = resp.data.values || [];
      } catch {
        values = [];
      }

      const headers =
        values.length > 0
          ? values[0]
          : ["user_id", "account_name", "picture_url", "status_message", "permission", "created_at"];
      const rows = values.slice(1);

      const userIdIdx = headers.indexOf("user_id");
      const permIdx = headers.indexOf("permission");
      const existing = rows.find((r) => r[userIdIdx] === userId);

      if (existing) {
        const permission = parseInt(existing[permIdx] ?? "0", 10);
        return res.json({ permission, isNew: false });
      }

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

  app.get("/api/sheets/:sheetName", async (req, res) => {
    const { sheetName } = req.params;

    if (GOOGLE_SHEET_ID && GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const key = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
        const auth = new google.auth.GoogleAuth({
          credentials: key,
          scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: "v4", auth });
        const rangeCandidates = [sheetName, `'${sheetName}'`, `${sheetName}!A:Z`, `'${sheetName}'!A:Z`];
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
            console.warn("Range failed:", range, (err as any)?.message || err);
          }
        }
        if (!resp) throw new Error("All range formats failed");
        const values: string[][] = resp.data.values || [];
        if (values.length === 0) return res.json({ rows: [], options: [], normalized: [] });
        const headers = values[0];
        const rows = values.slice(1).map((row) => {
          const obj: Record<string, string> = {};
          headers.forEach((h: string, i: number) => {
            obj[h] = row[i] ?? "";
          });
          return obj;
        });

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

    if (GOOGLE_SHEET_ID && GOOGLE_API_KEY) {
      try {
        const rangeCandidates = [sheetName, `'${sheetName}'`, `${sheetName}!A:Z`, `'${sheetName}'!A:Z`];
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
            console.warn("Range URL failed:", r, (err as any)?.message || err);
          }
        }
        if (!json) throw new Error("All range formats failed with API key");
        const values: string[][] = json.values || [];
        if (values.length === 0) return res.json({ rows: [], options: [], normalized: [] });
        const headers = values[0];
        const rows = values.slice(1).map((row) => {
          const obj: Record<string, string> = {};
          headers.forEach((h: string, i: number) => {
            obj[h] = row[i] ?? "";
          });
          return obj;
        });

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

  app.get("/api/cases", async (req, res) => {
    try {
      const cases = await readSheetAsObjects("case");
      console.log(cases);
      const activeCases = cases.filter((c) => !c.isArchived);
      res.json(activeCases);
    } catch (err) {
      console.error("Failed to load cases from sheet:", err);
      res.status(500).json({ error: "Failed to load cases" });
    }
  });

  app.get("/api/cases/archived", async (req, res) => {
    try {
      const cases = await readSheetAsObjects("case");
      const archivedCases = cases.filter((c) => c.isArchived);
      res.json(archivedCases);
    } catch (err) {
      console.error("Failed to load archived cases from sheet:", err);
      res.status(500).json({ error: "Failed to load archived cases" });
    }
  });

  app.post("/api/cases", upload.single("courtDocument"), async (req, res) => {
    console.log("Received case data:", req.body);
    if (req.file) {
      console.log("Received file:", req.file.originalname);
    }

    try {
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

      if (req.file) {
        const { taskType, docNumber } = newCase;
        const filePath = generateUniqueFilename(req.file.originalname, taskType, docNumber);
        const supabaseLink = await uploadFileToSupabase(req.file.buffer, filePath, req.file.mimetype);
        if (supabaseLink) newCase.courtDocument = supabaseLink;
      }

      if (typeof newCase.fn_additionalFees === "string") {
        try {
          newCase.fn_additionalFees = JSON.parse(newCase.fn_additionalFees);
        } catch {
          newCase.fn_additionalFees = [];
        }
      }

      const [sourceOptions, docStateOptions, taskStateOptions, lawyerOptions, fineTypeOptions, customerOptions] = await Promise.all([
        getSheetOptions("source"),
        getSheetOptions("doc_state"),
        getSheetOptions("task_state"),
        getSheetOptions("lawyer"),
        getSheetOptions("fine_type"),
        getSheetOptions("customer"),
      ]);

      newCase.sourceName = (sourceOptions.find((o: any) => o.id === newCase.source) || {}).label || newCase.sourceName || "";
      newCase.docStateName = (docStateOptions.find((o: any) => o.id === newCase.docState) || {}).label || newCase.docStateName || "";
      newCase.taskStateName = (taskStateOptions.find((o: any) => o.id === newCase.taskState) || {}).label || newCase.taskStateName || "";
      newCase.lawyerName = (lawyerOptions.find((o: any) => o.id === newCase.lawyer) || {}).label || newCase.lawyerName || "";
      newCase.fn_fineTypeName = (fineTypeOptions.find((o: any) => o.id === newCase.fn_fineType) || {}).label || newCase.fn_fineTypeName || "";
      newCase.fn_customerName = (customerOptions.find((o: any) => o.id === newCase.fn_customer) || {}).label || newCase.fn_customerName || "";

      console.log("Resolved labels before append:", {
        source: newCase.sourceName,
        docState: newCase.docStateName,
        taskState: newCase.taskStateName,
        lawyer: newCase.lawyerName,
        fn_fineType: newCase.fn_fineTypeName,
        fn_customer: newCase.fn_customerName,
      });

      const sheets = await getSheetsClient();
      const headers = await getSheetHeaders("case");
      const defaultHeaders = [
        "id",
        "taskType",
        "receiveDate",
        "docNumber",
        "source",
        "sourceName",
        "docState",
        "docStateName",
        "taskState",
        "taskStateName",
        "lawyer",
        "lawyerName",
        "returnDocNumber",
        "cc_licensePlate",
        "cc_driverName",
        "cc_ReferenceNumber",
        "cc_damageAmount",
        "op_ReferenceNumber",
        "op_customerName",
        "fn_customerName",
        "op_OverdueBillStart",
        "op_overdueBillEnd",
        "op_amount",
        "fn_fineType",
        "fn_fineTypeName",
        "fn_ReferenceNumber",
        "fn_OverdueBillStart",
        "fn_OverdueBillEnd",
        "fn_amount",
        "fn_additionalFees",
        "fn_totalAmount",
        "notes",
        "isArchived",
        "isFinish",
        "courtDocument",
      ];
      const effectiveHeaders = headers.length > 0 ? headers : defaultHeaders;
      console.log("Using headers for append:", effectiveHeaders);

      const rowData = { ...newCase };
      if (Array.isArray(rowData.fn_additionalFees)) {
        rowData.fn_additionalFees = JSON.stringify(rowData.fn_additionalFees);
      }

      const row = effectiveHeaders.map((h) => rowData[h] ?? "");
      console.log("Row to append:", row);

      if (sheets) {
        const appendResp = await sheets.spreadsheets.values.append({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: "case!A:AZ",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [row] },
        });
        console.log("Sheets append response status:", appendResp?.status);
        console.log("Sheets append response data:", appendResp?.data);
      } else if (GOOGLE_API_KEY) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/case!A:AZ:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&key=${GOOGLE_API_KEY}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: [row] }),
        });
        const text = await resp.text();
        console.log("API-key append response status:", resp.status, "body:", text);
      } else {
        console.warn("No Sheets client or API key, cannot append case to sheet");
      }

      res.json({ success: true, message: "บันทึกข้อมูลสำเร็จ", data: newCase });
    } catch (err) {
      console.error("Failed to append case to Google Sheet:", err);
      res.status(500).json({ error: "Failed to save case" });
    }
  });

  app.put("/api/cases/:id", upload.single("courtDocument"), async (req, res) => {
    console.log(`Updating case ${req.params.id}:`, req.body);
    if (req.file) {
      console.log("Received file update:", req.file.originalname);
    }

    try {
      const updateData: any = { ...req.body };

      const cases = await readSheetAsObjects("case");
      const existing = cases.find((c) => String(c.id) === String(req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Case not found" });
      }

      if (req.file) {
        const taskType = updateData.taskType || existing.taskType;
        const docNumber = updateData.docNumber || existing.docNumber;
        const filePath = generateUniqueFilename(req.file.originalname, taskType, docNumber);
        const supabaseLink = await uploadFileToSupabase(req.file.buffer, filePath, req.file.mimetype);
        if (supabaseLink) updateData.courtDocument = supabaseLink;
      }

      if (typeof updateData.fn_additionalFees === "string") {
        try {
          updateData.fn_additionalFees = JSON.parse(updateData.fn_additionalFees);
        } catch {
          updateData.fn_additionalFees = [];
        }
      }

      const [sourceOptions, docStateOptions, taskStateOptions, lawyerOptions, fineTypeOptions, customerOptions] = await Promise.all([
        getSheetOptions("source"),
        getSheetOptions("doc_state"),
        getSheetOptions("task_state"),
        getSheetOptions("lawyer"),
        getSheetOptions("fine_type"),
        getSheetOptions("customer"),
      ]);
      if (updateData.source)
        updateData.sourceName = (sourceOptions.find((o: any) => o.id === updateData.source) || {}).label || updateData.sourceName || "";
      if (updateData.docState)
        updateData.docStateName = (docStateOptions.find((o: any) => o.id === updateData.docState) || {}).label || updateData.docStateName || "";
      if (updateData.taskState)
        updateData.taskStateName = (taskStateOptions.find((o: any) => o.id === updateData.taskState) || {}).label || updateData.taskStateName || "";
      if (updateData.lawyer)
        updateData.lawyerName = (lawyerOptions.find((o: any) => o.id === updateData.lawyer) || {}).label || updateData.lawyerName || "";
      if (updateData.fn_fineType)
        updateData.fn_fineTypeName = (fineTypeOptions.find((o: any) => o.id === updateData.fn_fineType) || {}).label || updateData.fn_fineTypeName || "";
      if (updateData.fn_customer)
        updateData.fn_customerName = (customerOptions.find((o: any) => o.id === updateData.fn_customer) || {}).label || updateData.fn_customerName || "";
      if (updateData.fn_customer)
        updateData.fn_customerName = (customerOptions.find((o: any) => o.id === updateData.fn_customer) || {}).label || updateData.fn_customerName || "";

      const rowNum = existing.__rowNum;
      const headers = await getSheetHeaders("case");
      const defaultHeaders = [
        "id",
        "taskType",
        "receiveDate",
        "docNumber",
        "source",
        "sourceName",
        "docState",
        "docStateName",
        "taskState",
        "taskStateName",
        "lawyer",
        "lawyerName",
        "returnDocNumber",
        "cc_licensePlate",
        "cc_driverName",
        "cc_ReferenceNumber",
        "cc_damageAmount",
        "op_ReferenceNumber",
        "op_customerName",
        "fn_customerName",
        "op_OverdueBillStart",
        "op_overdueBillEnd",
        "op_amount",
        "fn_fineType",
        "fn_fineTypeName",
        "fn_ReferenceNumber",
        "fn_OverdueBillStart",
        "fn_OverdueBillEnd",
        "fn_amount",
        "fn_additionalFees",
        "fn_totalAmount",
        "notes",
        "isArchived",
        "isFinish",
        "courtDocument",
      ];
      const effectiveHeaders = headers.length > 0 ? headers : defaultHeaders;
      const updated = { ...existing, ...updateData };

      if (Array.isArray(updated.fn_additionalFees)) {
        updated.fn_additionalFees = JSON.stringify(updated.fn_additionalFees);
      }

      const row = effectiveHeaders.map((h) => updated[h] ?? "");

      const sheets = await getSheetsClient();
      if (sheets) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: `case!A${rowNum}:AZ${rowNum}`,
          valueInputOption: "RAW",
          requestBody: { values: [row] },
        });
      } else if (GOOGLE_API_KEY) {
        const range = `case!A${rowNum}:AZ${rowNum}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW&key=${GOOGLE_API_KEY}`;
        await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: [row] }),
        });
      }

      res.json({ success: true, message: "อัปเดตข้อมูลสำเร็จ" });
    } catch (err) {
      console.error("Failed to update case", err);
      res.status(500).json({ error: "Failed to update case" });
    }
  });

  app.patch("/api/cases/:id/state", express.json(), async (req, res) => {
    const { taskState, taskStateName } = req.body;

    try {
      const cases = await readSheetAsObjects("case");
      const existing = cases.find((c) => String(c.id) === String(req.params.id));
      if (!existing) return res.status(404).json({ error: "Case not found" });

      const updated = { ...existing, taskState, taskStateName } as any;
      const rowNum = existing.__rowNum;
      const headers = await getSheetHeaders("case");
      const defaultHeaders = [
        "id",
        "taskType",
        "receiveDate",
        "docNumber",
        "source",
        "sourceName",
        "docState",
        "docStateName",
        "taskState",
        "taskStateName",
        "lawyer",
        "lawyerName",
        "returnDocNumber",
        "cc_licensePlate",
        "cc_driverName",
        "cc_ReferenceNumber",
        "cc_damageAmount",
        "op_ReferenceNumber",
        "op_customerName",
        "fn_customerName",
        "op_OverdueBillStart",
        "op_overdueBillEnd",
        "op_amount",
        "fn_fineType",
        "fn_fineTypeName",
        "fn_ReferenceNumber",
        "fn_OverdueBillStart",
        "fn_OverdueBillEnd",
        "fn_amount",
        "fn_additionalFees",
        "fn_totalAmount",
        "notes",
        "isArchived",
        "isFinish",
        "courtDocument",
      ];
      const effectiveHeaders = headers.length > 0 ? headers : defaultHeaders;

      if (Array.isArray(updated.fn_additionalFees)) {
        updated.fn_additionalFees = JSON.stringify(updated.fn_additionalFees);
      }

      const row = effectiveHeaders.map((h) => updated[h] ?? "");

      const sheets = await getSheetsClient();
      if (sheets) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: `case!A${rowNum}:AZ${rowNum}`,
          valueInputOption: "RAW",
          requestBody: { values: [row] },
        });
      } else if (GOOGLE_API_KEY) {
        const range = `case!A${rowNum}:AZ${rowNum}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW&key=${GOOGLE_API_KEY}`;
        await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: [row] }),
        });
      }

      res.json({ success: true, message: "อัปเดตสถานะสำเร็จ" });
    } catch (err) {
      console.error("Failed to update case state", err);
      res.status(500).json({ error: "Failed to update case state" });
    }
  });

  app.patch("/api/cases/:id/archive", express.json(), async (req, res) => {
    const { isFinish } = req.body;
    try {
      const cases = await readSheetAsObjects("case");
      const existing = cases.find((c) => String(c.id) === String(req.params.id));
      if (!existing) return res.status(404).json({ error: "Case not found" });

      const updated = { ...existing, isArchived: true } as any;
      if (isFinish) {
        updated.isFinish = "TRUE";
      }
      const rowNum = existing.__rowNum;
      const headers = await getSheetHeaders("case");
      const defaultHeaders = [
        "id",
        "taskType",
        "receiveDate",
        "docNumber",
        "source",
        "sourceName",
        "docState",
        "docStateName",
        "taskState",
        "taskStateName",
        "lawyer",
        "lawyerName",
        "returnDocNumber",
        "cc_licensePlate",
        "cc_driverName",
        "cc_ReferenceNumber",
        "cc_damageAmount",
        "op_ReferenceNumber",
        "op_customerName",
        "fn_customerName",
        "op_OverdueBillStart",
        "op_overdueBillEnd",
        "op_amount",
        "fn_fineType",
        "fn_fineTypeName",
        "fn_ReferenceNumber",
        "fn_OverdueBillStart",
        "fn_OverdueBillEnd",
        "fn_amount",
        "fn_additionalFees",
        "fn_totalAmount",
        "notes",
        "isArchived",
        "isFinish",
        "courtDocument",
      ];
      const effectiveHeaders = headers.length > 0 ? headers : defaultHeaders;

      if (Array.isArray(updated.fn_additionalFees)) {
        updated.fn_additionalFees = JSON.stringify(updated.fn_additionalFees);
      }

      const row = effectiveHeaders.map((h) => updated[h] ?? "");

      const sheets = await getSheetsClient();
      if (sheets) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: `case!A${rowNum}:AZ${rowNum}`,
          valueInputOption: "RAW",
          requestBody: { values: [row] },
        });
      } else if (GOOGLE_API_KEY) {
        const range = `case!A${rowNum}:AZ${rowNum}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW&key=${GOOGLE_API_KEY}`;
        await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: [row] }),
        });
      }

      res.json({ success: true, message: "จัดเก็บข้อมูลสำเร็จ" });
    } catch (err) {
      console.error("Failed to archive case", err);
      res.status(500).json({ error: "Failed to archive case" });
    }
  });

  app.patch("/api/cases/:id/unarchive", express.json(), async (req, res) => {
    try {
      const cases = await readSheetAsObjects("case");
      const existing = cases.find((c) => String(c.id) === String(req.params.id));
      if (!existing) return res.status(404).json({ error: "Case not found" });

      const updated = { ...existing, isArchived: false, isFinish: false } as any;
      const rowNum = existing.__rowNum;
      const headers = await getSheetHeaders("case");
      const defaultHeaders = [
        "id",
        "taskType",
        "receiveDate",
        "docNumber",
        "source",
        "sourceName",
        "docState",
        "docStateName",
        "taskState",
        "taskStateName",
        "lawyer",
        "lawyerName",
        "returnDocNumber",
        "cc_licensePlate",
        "cc_driverName",
        "cc_ReferenceNumber",
        "cc_damageAmount",
        "op_ReferenceNumber",
        "op_customerName",
        "fn_customerName",
        "op_OverdueBillStart",
        "op_overdueBillEnd",
        "op_amount",
        "fn_fineType",
        "fn_fineTypeName",
        "fn_ReferenceNumber",
        "fn_OverdueBillStart",
        "fn_OverdueBillEnd",
        "fn_amount",
        "fn_additionalFees",
        "fn_totalAmount",
        "notes",
        "isArchived",
        "isFinish",
        "courtDocument",
      ];
      const effectiveHeaders = headers.length > 0 ? headers : defaultHeaders;

      if (Array.isArray(updated.fn_additionalFees)) {
        updated.fn_additionalFees = JSON.stringify(updated.fn_additionalFees);
      }

      const row = effectiveHeaders.map((h) => updated[h] ?? "");

      const sheets = await getSheetsClient();
      if (sheets) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID!,
          range: `case!A${rowNum}:AZ${rowNum}`,
          valueInputOption: "RAW",
          requestBody: { values: [row] },
        });
      } else if (GOOGLE_API_KEY) {
        const range = `case!A${rowNum}:AZ${rowNum}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW&key=${GOOGLE_API_KEY}`;
        await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: [row] }),
        });
      }

      res.json({ success: true, message: "ยกเลิกการจัดเก็บสำเร็จ" });
    } catch (err) {
      console.error("Failed to unarchive case", err);
      res.status(500).json({ error: "Failed to unarchive case" });
    }
  });

  app.delete("/api/cases/:id", async (req, res) => {
    try {
      const cases = await readSheetAsObjects("case");
      const existing = cases.find((c) => String(c.id) === String(req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Case not found" });
      }

      const rowNum = existing.__rowNum;

      const sheets = await getSheetsClient();
      if (sheets) {
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: GOOGLE_SHEET_ID!,
        });

        const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === "case");

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

  return app;
}

const app = createApplication();
export default app;
