import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mock API for Google Sheets data
  app.get("/api/sheets/:sheetName", (req, res) => {
    const { sheetName } = req.params;
    // Mock data for dropdowns
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

    res.json(mockData[sheetName] || []);
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
