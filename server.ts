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
        console.log(normalized)
        console.log(`Fetched ${rows.toString()} rows from Google Sheets (service account)`);
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

    // Mock data for dropdowns (fallback)
    const mockData: Record<string, any[]> = {
      source: [
        { id: "1", label: "ศาลแพ่ง" },
        { id: "2", label: "ศาลอาญา" },
        { id: "3", label: "ตำรวจ" },
      ],
      doc_state: [
        { id: "1", label: "ผ่าน" },
        { id: "2", label: "ไม่ผ่าน" },
        { id: "3", label: "รอตรวจสอบ" },
      ],
      task_state: [
        { id: "1", label: "รับเรื่อง" },
        { id: "2", label: "กำลังดำเนินการ" },
        { id: "3", label: "เสร็จสิ้น" },
      ],
      lawyer: [
        { id: "1", label: "ทนายสมชาย" },
        { id: "2", label: "ทนายสมหญิง" },
        { id: "3", label: "ทนายวิชัย" },
      ],
    };

    return res.json(mockData[sheetName] || []);
  });

  // Mock API to get all cases
  let mockCases = Array.from({ length: 35 }).map((_, i) => {
    const isCarCrash = i % 2 === 0;
    return {
      id: `${i + 1}`,
      taskType: isCarCrash ? "car_crash" : "overdue_payment",
      receiveDate: `2026-03-${(i % 28 + 1).toString().padStart(2, '0')}`,
      docNumber: `รย.${1000 + i}/2569`,
      source: (i % 3 + 1).toString(),
      sourceName: i % 3 === 0 ? "ศาลแพ่ง" : i % 3 === 1 ? "ศาลอาญา" : "ตำรวจ",
      docState: (i % 3 + 1).toString(),
      docStateName: i % 3 === 0 ? "ผ่าน" : i % 3 === 1 ? "ไม่ผ่าน" : "รอตรวจสอบ",
      taskState: (i % 3 + 1).toString(),
      taskStateName: i % 3 === 0 ? "รับเรื่อง" : i % 3 === 1 ? "กำลังดำเนินการ" : "เสร็จสิ้น",
      lawyer: (i % 3 + 1).toString(),
      lawyerName: i % 3 === 0 ? "ทนายสมชาย" : i % 3 === 1 ? "ทนายสมหญิง" : "ทนายวิชัย",
      returnDocNumber: i % 4 === 0 ? `คด.${500+i}/2569` : "",
      licensePlate: isCarCrash ? `กท ${1000 + i}` : "",
      driverName: isCarCrash ? `นายสมชาย ใจดี ${i}` : "",
      damageAmount: isCarCrash ? `${50000 + i * 1000}` : "",
      referenceNumber: !isCarCrash ? `REF-00${123 + i}` : "",
      overdueBillStart: !isCarCrash ? "2025-01-01" : "",
      overdueBillEnd: !isCarCrash ? "2025-12-31" : "",
      amount: !isCarCrash ? `${120000 + i * 5000}` : "",
      isArchived: false
    };
  });

  app.get("/api/cases", (req, res) => {
    res.json(mockCases);
  });

  app.post("/api/cases", upload.single("courtDocument"), (req, res) => {
    console.log("Received case data:", req.body);
    if (req.file) {
      console.log("Received file:", req.file.originalname);
    }
    const newCase = {
      id: `${mockCases.length + 1}`,
      ...req.body,
      isArchived: false
    };
    mockCases.push(newCase);
    res.json({ success: true, message: "บันทึกข้อมูลสำเร็จ" });
  });

  app.put("/api/cases/:id", upload.single("courtDocument"), (req, res) => {
    console.log(`Updating case ${req.params.id}:`, req.body);
    if (req.file) {
      console.log("Received file update:", req.file.originalname);
    }
    const index = mockCases.findIndex(c => c.id === req.params.id);
    if (index !== -1) {
      mockCases[index] = { ...mockCases[index], ...req.body };
    }
    res.json({ success: true, message: "อัปเดตข้อมูลสำเร็จ" });
  });

  app.patch("/api/cases/:id/state", express.json(), (req, res) => {
    const { taskState, taskStateName } = req.body;
    const index = mockCases.findIndex(c => c.id === req.params.id);
    if (index !== -1) {
      mockCases[index].taskState = taskState;
      mockCases[index].taskStateName = taskStateName;
    }
    res.json({ success: true, message: "อัปเดตสถานะสำเร็จ" });
  });

  app.patch("/api/cases/:id/archive", express.json(), (req, res) => {
    const index = mockCases.findIndex(c => c.id === req.params.id);
    if (index !== -1) {
      mockCases[index].isArchived = true;
    }
    res.json({ success: true, message: "จัดเก็บข้อมูลสำเร็จ" });
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
