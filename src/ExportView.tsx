import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Car, CreditCard, Gavel, FileCheck, Hash, AlertCircle, FileSpreadsheet } from 'lucide-react';

const TASK_TYPE_CONFIGS: Record<string, {
  label: string; color: string; bgColor: string; borderColor: string;
  icon: React.FC<any>;
  getRows: (c: any) => Record<string, any>[];
}> = {
  car_crash: {
    label: 'รถยนต์ชนเสา', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: Car,
    getRows: (c) => [{ 'เลขที่หนังสือ': c.docNumber || '', 'วันที่รับเรื่อง': c.receiveDate || '', 'ต้นทางเอกสาร': c.sourceName || '', 'ผู้รับผิดชอบ': c.lawyerName || '', 'สถานะงาน': c.taskStateName || '', 'ผลการตรวจเอกสาร': c.docStateName || '', 'ทะเบียนรถ': c.cc_licensePlate || '', 'ชื่อ-นามสกุล คนขับ/ประกัน': c.cc_driverName || '', 'หมายเลขอ้างอิง CA': c.cc_ReferenceNumber || '', 'ยอดเสียหาย (บาท)': c.cc_damageAmount || '', 'หมายเหตุ': c.notes || '' }],
  },
  overdue_payment: {
    label: 'ค่าไฟฟ้าค้างชำระ', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', icon: CreditCard,
    getRows: (c) => {
      const ds = Array.isArray(c.op_details) && c.op_details.length > 0 ? c.op_details : [{ op_ReferenceNumber: c.op_ReferenceNumber, op_OverdueBillStart: c.op_OverdueBillStart, op_overdueBillEnd: c.op_overdueBillEnd, op_amount: c.op_amount }];
      return ds.map((d: any) => ({ 'เลขที่หนังสือ': c.docNumber || '', 'วันที่รับเรื่อง': c.receiveDate || '', 'ต้นทางเอกสาร': c.sourceName || '', 'ผู้รับผิดชอบ': c.lawyerName || '', 'สถานะงาน': c.taskStateName || '', 'ผลการตรวจเอกสาร': c.docStateName || '', 'ชื่อนามสกุล': c.op_customerName || '', 'หมายเลขอ้างอิง CA': d.op_ReferenceNumber || '', 'บิลตั้งแต่': d.op_OverdueBillStart || '', 'บิลถึง': d.op_overdueBillEnd || '', 'จำนวนเงิน (บาท)': d.op_amount || '', 'หมายเหตุ': c.notes || '' }));
    },
  },
  fine: {
    label: 'ค่าละเมิดการใช้ไฟฟ้า', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: Gavel,
    getRows: (c) => {
      const ds = Array.isArray(c.fn_details) && c.fn_details.length > 0 ? c.fn_details : [{ fn_ReferenceNumber: c.fn_ReferenceNumber, fn_OverdueBillStart: c.fn_OverdueBillStart, fn_OverdueBillEnd: c.fn_OverdueBillEnd, fn_amount: c.fn_amount }];
      const addStr = (Array.isArray(c.fn_additionalFees) ? c.fn_additionalFees : []).map((f: any) => `${f.name}: ${f.amount}`).join(', ');
      return ds.map((d: any) => ({ 'เลขที่หนังสือ': c.docNumber || '', 'วันที่รับเรื่อง': c.receiveDate || '', 'ต้นทางเอกสาร': c.sourceName || '', 'ผู้รับผิดชอบ': c.lawyerName || '', 'สถานะงาน': c.taskStateName || '', 'ผลการตรวจเอกสาร': c.docStateName || '', 'ชื่อนามสกุล': c.fn_customerName || '', 'ประเภทค่าปรับ': c.fn_fineTypeName || '', 'หมายเลขอ้างอิง CA': d.fn_ReferenceNumber || '', 'ช่วงบิลตั้งแต่': d.fn_OverdueBillStart || '', 'ช่วงบิลถึง': d.fn_OverdueBillEnd || '', 'ค่าเบี้ยปรับ (บาท)': d.fn_amount || '', 'ค่าอื่นๆ': addStr, 'รวมทั้งสิ้น': c.fn_totalAmount || '', 'หมายเหตุ': c.notes || '' }));
    },
  },
  gov_debt: {
    label: 'ลูกหนี้ราชการ', color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200', icon: FileCheck,
    getRows: (c) => {
      const ds = Array.isArray(c.fngov_details) && c.fngov_details.length > 0 ? c.fngov_details : [{}];
      const addStr = (Array.isArray(c.fngov_additionalFees) ? c.fngov_additionalFees : []).map((f: any) => `${f.name}: ${f.amount}`).join(', ');
      return ds.map((d: any) => ({ 'เลขที่หนังสือ': c.docNumber || '', 'วันที่รับเรื่อง': c.receiveDate || '', 'ต้นทางเอกสาร': c.sourceName || '', 'ผู้รับผิดชอบ': c.lawyerName || '', 'สถานะงาน': c.taskStateName || '', 'ผลการตรวจเอกสาร': c.docStateName || '', 'ชื่อนามสกุล': c.fngov_customerName || '', 'หมายเลขอ้างอิง CA': d.fngov_ReferenceNumber || '', 'สาขาหน่วยงาน': d.fngov_agencyBranch || '', 'บิลตั้งแต่': d.fngov_OverdueBillStart || '', 'บิลถึง': d.fngov_overdueBillEnd || '', 'จำนวนเงิน (บาท)': d.fngov_amount || '', 'ค่าอื่นๆ': addStr, 'หมายเหตุ': c.notes || '' }));
    },
  },
  fine_btc: {
    label: 'ค่าละเมิดบิทคอยน์', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', icon: Hash,
    getRows: (c) => {
      const ds = Array.isArray(c.fnbtc_details) && c.fnbtc_details.length > 0 ? c.fnbtc_details : [{}];
      const addStr = (Array.isArray(c.fnbtc_additionalFees) ? c.fnbtc_additionalFees : []).map((f: any) => `${f.name}: ${f.amount}`).join(', ');
      return ds.map((d: any) => ({ 'เลขที่หนังสือ': c.docNumber || '', 'วันที่รับเรื่อง': c.receiveDate || '', 'ต้นทางเอกสาร': c.sourceName || '', 'ผู้รับผิดชอบ': c.lawyerName || '', 'สถานะงาน': c.taskStateName || '', 'ผลการตรวจเอกสาร': c.docStateName || '', 'ชื่อนามสกุล': c.fnbtc_customerName || '', 'หมายเลขอ้างอิง CA': d.fnbtc_ReferenceNumber || '', 'บิลตั้งแต่': d.fnbtc_OverdueBillStart || '', 'บิลถึง': d.fnbtc_overdueBillEnd || '', 'จำนวนเงิน (บาท)': d.fnbtc_amount || '', 'ค่าอื่นๆ': addStr, 'หมายเหตุ': c.notes || '' }));
    },
  },
  fine_cable: {
    label: 'ค่าละเมิดสายสื่อสาร', color: 'text-cyan-700', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200', icon: AlertCircle,
    getRows: (c) => [{ 'เลขที่หนังสือ': c.docNumber || '', 'วันที่รับเรื่อง': c.receiveDate || '', 'ต้นทางเอกสาร': c.sourceName || '', 'ผู้รับผิดชอบ': c.lawyerName || '', 'สถานะงาน': c.taskStateName || '', 'ผลการตรวจเอกสาร': c.docStateName || '', 'ชื่อนามสกุล': c.fncable_customerName || '', 'จำนวนเงิน (บาท)': c.fncable_amount || '', 'วันที่ตรวจพบ': c.fncable_detectedDate || '', 'หมายเหตุ': c.notes || '' }],
  },
};

const ExportView = ({ cases }: { cases: any[] }) => {
  const [selectedType, setSelectedType] = useState('car_crash');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const isArchived = (v: any) => {
    if (typeof v === 'string') return v.trim().toLowerCase() === 'true' || v === '1';
    return Boolean(v);
  };

  const filteredCases = cases.filter(c => {
    if (isArchived(c.isArchived)) return false;
    if (c.taskType !== selectedType) return false;
    if (dateFrom && (c.receiveDate || '') < dateFrom) return false;
    if (dateTo && (c.receiveDate || '') > dateTo) return false;
    return true;
  });

  const cfg = TASK_TYPE_CONFIGS[selectedType];
  const previewRows = filteredCases.flatMap(c => cfg.getRows(c)).map(row => {
    const cleaned: Record<string, any> = {};
    for (const k of Object.keys(row)) cleaned[k] = row[k] ?? '';
    return cleaned;
  });

  // Generate column headers from config using empty case
  const colHeaders = previewRows.length > 0
    ? Object.keys(previewRows[0])
    : Object.keys(cfg.getRows({})[0] ?? {});

  const handleExport = () => {
    if (previewRows.length === 0) { alert('ไม่มีข้อมูลที่จะส่งออก'); return; }
    setIsExporting(true);
    try {
      const ws = XLSX.utils.json_to_sheet(previewRows);
      ws['!cols'] = colHeaders.map(k => ({ wch: Math.max(k.length * 2, 14) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, cfg.label.substring(0, 31));
      const suffix = (dateFrom || dateTo) ? `_${dateFrom || 'all'}_${dateTo || 'all'}` : '';
      XLSX.writeFile(wb, `export_${selectedType}${suffix}.xlsx`);
    } catch {
      alert('เกิดข้อผิดพลาดในการส่งออก');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">ส่งออกข้อมูล</h2>
        <p className="text-slate-500 mt-1">เลือกประเภทงานและช่วงวันที่รับเรื่อง แล้วส่งออกเป็นไฟล์ Excel</p>
      </div>

      {/* Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(TASK_TYPE_CONFIGS).map(([key, config]) => {
          const Icon = config.icon;
          const active = selectedType === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedType(key)}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                active
                  ? `${config.borderColor} ${config.bgColor} ${config.color} shadow-md scale-[1.02]`
                  : 'border-slate-100 bg-white/60 text-slate-500 hover:border-slate-200 hover:bg-white/80'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[11px] font-semibold text-center leading-tight">{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter + Export Button */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="space-y-1.5 flex-1">
            <label className="text-sm font-medium text-slate-700">วันที่รับเรื่อง (ตั้งแต่)</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="space-y-1.5 flex-1">
            <label className="text-sm font-medium text-slate-700">วันที่รับเรื่อง (ถึง)</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex gap-3 shrink-0">
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="px-4 py-3 rounded-2xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                ล้างวันที่
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-70 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-5 h-5" />
              {isExporting ? 'กำลังส่งออก...' : `ส่งออก Excel (${previewRows.length} แถว)`}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          {(() => { const Icon = cfg.icon; return <Icon className={`w-5 h-5 ${cfg.color}`} />; })()}
          <span className="font-semibold text-slate-700">{cfg.label}</span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bgColor} ${cfg.color} border ${cfg.borderColor}`}>
            {filteredCases.length} คดี · {previewRows.length} แถว
          </span>
        </div>
        <div className="overflow-x-auto">
          {previewRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <FileSpreadsheet className="w-12 h-12 text-slate-200" />
              <p className="font-medium">ไม่พบข้อมูลในช่วงที่เลือก</p>
              <p className="text-sm">ลองเปลี่ยนประเภทงานหรือช่วงวันที่</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {colHeaders.map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-white/80 transition-colors">
                    {colHeaders.map(h => (
                      <td key={h} className="px-4 py-2.5 text-slate-700 whitespace-nowrap max-w-[220px] truncate" title={String(row[h])}>
                        {String(row[h]) || <span className="text-slate-300">-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {previewRows.length > 50 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-sm text-slate-500 text-center">
            แสดงตัวอย่าง 50 แถวแรก · ไฟล์ Excel จะมีทั้งหมด {previewRows.length} แถว
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportView;
