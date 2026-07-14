import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  FileText, Car, CreditCard, Upload, CheckCircle2, AlertCircle, Search, ChevronDown,
  LayoutDashboard, PlusCircle, Menu, X, ChevronLeft, ChevronRight, Edit2,
  Archive, BarChart2, PanelLeftClose, PanelLeftOpen, GripVertical, Gavel, Trash2, Plus,
  User, Hash, ClipboardList, FileCheck, FolderArchive, XCircle, LogOut, ShieldCheck, Clock, Download
} from 'lucide-react';

declare const liff: any;

// ── Auth Context ──────────────────────────────────────────────
type AuthUser = { userId: string; displayName: string; pictureUrl: string; permission: number };
const AuthContext = createContext<AuthUser | null>(null);
const useAuth = () => useContext(AuthContext);

const downloadCaseWord = async (caseId: string) => {
  const response = await fetch(`/api/cases/${caseId}/word`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'ไม่สามารถดาวน์โหลดเอกสาร Word ได้');
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  let filename = match?.[1] || `case-${caseId}.docx`;
  try {
    filename = decodeURIComponent(filename);
  } catch (e) {
    // If it fails to decode, keep the original extracted string
  }
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export const parseCourtDocuments = (data: any) => {
  if (!data) return [];
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    } catch { }
    // fallback comma separated
    return data.split(',').filter(Boolean).map((docUrl: string, idx: number) => {
      let displayName = `เอกสารที่ ${idx + 1}`;
      try {
        const filename = decodeURIComponent(docUrl.split('/').pop() || '');
        const match = filename.match(/^(.*?)-[a-z0-9]{12}(\.[^.]+)$/i);
        if (match && match[1]) displayName = match[1];
        else {
          const basic = filename.replace(/\.[^/.]+$/, "");
          if (basic) displayName = basic;
        }
      } catch { }
      return { name: displayName, url: docUrl };
    });
  }
  if (Array.isArray(data)) return data;
  return [];
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, children, isConfirming, variant = 'danger' }: any) => {
  if (!isOpen) return null;

  const colors = {
    danger: {
      icon: <AlertCircle className="w-8 h-8 text-red-500" />,
      buttonClass: 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30',
    },
    warning: {
      icon: <Archive className="w-8 h-8 text-amber-500" />,
      buttonClass: 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/30',
    }
  };

  const selectedVariant = colors[variant as keyof typeof colors] || colors.danger;


  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white/90 backdrop-blur-3xl rounded-3xl shadow-2xl w-full max-w-md p-8 border border-white/40"
      >
        <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-3">
          {selectedVariant.icon}
          {title || "ยืนยันการกระทำ"}
        </h2>
        <div className="text-slate-600 mb-8">
          {children}
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="w-full sm:w-auto px-6 py-3.5 sm:py-3 rounded-2xl font-medium text-slate-600 bg-slate-100 sm:bg-transparent hover:bg-slate-200/50 transition-colors disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className={`w-full sm:w-auto px-6 py-3.5 sm:py-3 rounded-2xl font-medium text-white transition-all flex items-center justify-center sm:min-w-[120px] disabled:opacity-50 ${selectedVariant.buttonClass}`}
          >
            {isConfirming ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'ยืนยัน'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Types ---
type DropdownOption = { id: string; label: string };
type Dropdowns = {
  source: DropdownOption[];
  docState: DropdownOption[];
  taskState: DropdownOption[];
  lawyer: DropdownOption[];
  fineType: DropdownOption[];
  uploadFileTypes: DropdownOption[];
};

// --- Components ---

// Searchable Select (Combobox)
const SearchableSelect = ({ options = [], value, onChange, placeholder, required = false }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt: any) =>
    (opt.label || "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find((opt: any) => opt.id === value);

  return (
    <div className="relative" ref={wrapperRef}>
      <div
        className={`flex items-center justify-between w-full px-4 py-3 bg-white/50 backdrop-blur-md border ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'} rounded-2xl cursor-pointer transition-all duration-200`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? "text-slate-900" : "text-slate-400"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] w-full mt-2 bg-white/90 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-slate-100">
              <div className="flex items-center px-3 py-2 bg-slate-100/50 rounded-xl">
                <Search className="w-4 h-4 text-slate-400 mr-2" />
                <input
                  type="text"
                  className="w-full bg-transparent border-none outline-none text-sm text-slate-700 placeholder-slate-400"
                  placeholder="ค้นหา..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt: any) => (
                  <div
                    key={opt.id}
                    className={`px-4 py-2.5 rounded-xl cursor-pointer text-sm transition-colors ${value === opt.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50 text-slate-700'}`}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                  >
                    {opt.label}
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-slate-500 text-center">ไม่พบข้อมูล</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {required && <input type="text" value={value} readOnly className="absolute opacity-0 w-0 h-0" required />}
    </div>
  );
};

const CreatableAutocomplete = ({ options = [], value, onChange, placeholder, required = false }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt: any) =>
    (opt.label || "").toLowerCase().includes((value || "").toLowerCase())
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400"
      />
      <ChevronDown className={`absolute right-3 top-3 w-5 h-5 text-slate-400 transition-transform duration-200 pointer-events-none ${isOpen ? 'rotate-180' : ''}`} />

      <AnimatePresence>
        {isOpen && filteredOptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] w-full mt-1 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-xl shadow-lg max-h-48 overflow-y-auto"
          >
            {filteredOptions.map((opt: any) => (
              <div
                key={opt.id}
                className="px-4 py-2.5 cursor-pointer text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                onClick={() => {
                  onChange(opt.label);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Reusable Form Fields Component
const CaseFormFields = ({ formData, setFormData, files, setFiles, dropdowns, isEditMode = false }: any) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-8">
      {/* General Info Section */}
      <section className="bg-white/50 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/40 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" /> ข้อมูลทั่วไป
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ประเภทงาน - full width */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">ประเภทงาน <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <button
                type="button"
                disabled={isEditMode}
                onClick={() => setFormData({ ...formData, taskType: 'car_crash' })}
                className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border-2 transition-all min-h-[4rem] ${formData.taskType === 'car_crash'
                  ? 'border-blue-500 bg-blue-50/50 text-blue-700'
                  : 'border-slate-100 bg-white/50 text-slate-500 hover:border-slate-200'
                  } ${isEditMode ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <Car className="w-5 h-5 shrink-0" />
                <span className="text-[11px] font-medium text-center leading-tight">รถยนต์ชนเสา</span>
              </button>
              <button
                type="button"
                disabled={isEditMode}
                onClick={() => setFormData({ ...formData, taskType: 'overdue_payment' })}
                className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border-2 transition-all min-h-[4rem] ${formData.taskType === 'overdue_payment'
                  ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700'
                  : 'border-slate-100 bg-white/50 text-slate-500 hover:border-slate-200'
                  } ${isEditMode ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <CreditCard className="w-5 h-5 shrink-0" />
                <span className="text-[11px] font-medium text-center leading-tight">ค่าไฟฟ้าค้างชำระ</span>
              </button>
              <button
                type="button"
                disabled={isEditMode}
                onClick={() => setFormData({ ...formData, taskType: 'fine', fn_additionalFees: [] })}
                className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border-2 transition-all min-h-[4rem] ${formData.taskType === 'fine'
                  ? 'border-amber-500 bg-amber-50/50 text-amber-700'
                  : 'border-slate-100 bg-white/50 text-slate-500 hover:border-slate-200'
                  } ${isEditMode ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <Gavel className="w-5 h-5 shrink-0" />
                <span className="text-[11px] font-medium text-center leading-tight">ค่าละเมิดการใช้ไฟฟ้า</span>
              </button>
              <button
                type="button"
                disabled={isEditMode}
                onClick={() => setFormData({ ...formData, taskType: 'gov_debt', fngov_details: [], fngov_additionalFees: [] })}
                className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border-2 transition-all min-h-[4rem] ${formData.taskType === 'gov_debt'
                  ? 'border-violet-500 bg-violet-50/50 text-violet-700'
                  : 'border-slate-100 bg-white/50 text-slate-500 hover:border-slate-200'
                  } ${isEditMode ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <FileCheck className="w-5 h-5 shrink-0" />
                <span className="text-[11px] font-medium text-center leading-tight">ลูกหนี้ราชการ</span>
              </button>
              <button
                type="button"
                disabled={isEditMode}
                onClick={() => setFormData({ ...formData, taskType: 'fine_btc', fnbtc_details: [], fnbtc_additionalFees: [] })}
                className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border-2 transition-all min-h-[4rem] ${formData.taskType === 'fine_btc'
                  ? 'border-orange-500 bg-orange-50/50 text-orange-700'
                  : 'border-slate-100 bg-white/50 text-slate-500 hover:border-slate-200'
                  } ${isEditMode ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <Hash className="w-5 h-5 shrink-0" />
                <span className="text-[11px] font-medium text-center leading-tight">ค่าละเมิดบิทคอยน์</span>
              </button>
              <button
                type="button"
                disabled={isEditMode}
                onClick={() => setFormData({ ...formData, taskType: 'fine_cable' })}
                className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border-2 transition-all min-h-[4rem] ${formData.taskType === 'fine_cable'
                  ? 'border-cyan-500 bg-cyan-50/50 text-cyan-700'
                  : 'border-slate-100 bg-white/50 text-slate-500 hover:border-slate-200'
                  } ${isEditMode ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-[11px] font-medium text-center leading-tight">ค่าละเมิดสายสื่อสาร</span>
              </button>
            </div>
            {isEditMode && <p className="text-xs text-amber-600 ml-1 mt-1">ไม่สามารถแก้ไขประเภทงานได้</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">ต้นทางเอกสาร <span className="text-red-500">*</span></label>
            <SearchableSelect
              options={dropdowns.source}
              value={formData.source}
              onChange={(val: string) => setFormData({ ...formData, source: val })}
              placeholder="เลือกต้นทางเอกสาร..."
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">วันที่รับเรื่อง <span className="text-red-500">*</span></label>
            <input type="date" name="receiveDate" required value={formData.receiveDate} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">เลขที่หนังสือ <span className="text-red-500">*</span></label>
            <input type="text" name="docNumber" required value={formData.docNumber} onChange={handleChange} placeholder="ระบุเลขที่หนังสือ" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">ผลการตรวจเอกสาร <span className="text-red-500">*</span></label>
            <SearchableSelect
              options={dropdowns.docState}
              value={formData.docState}
              onChange={(val: string) => setFormData({ ...formData, docState: val })}
              placeholder="เลือกผลการตรวจ..."
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">เลขที่คืนเอกสาร</label>
            <input type="text" name="returnDocNumber" value={formData.returnDocNumber} onChange={handleChange} placeholder="(ถ้ามี)" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">เลขที่ อนุมัติฟ้อง</label>
            <input type="text" name="approvalDocNumber" value={formData.approvalDocNumber || ""} onChange={handleChange} placeholder="(ถ้ามี)" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">สถานะงาน <span className="text-red-500">*</span></label>
            <SearchableSelect
              options={dropdowns.taskState}
              value={formData.taskState}
              onChange={(val: string) => setFormData({ ...formData, taskState: val })}
              placeholder="เลือกสถานะงาน..."
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">ผู้รับผิดชอบ <span className="text-red-500">*</span></label>
            <SearchableSelect
              options={dropdowns.lawyer}
              value={formData.lawyer}
              onChange={(val: string) => setFormData({ ...formData, lawyer: val })}
              placeholder="เลือกทนายผู้รับผิดชอบ..."
              required
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700 ml-1">เอกสารจากศาล (อัปโหลดขึ้น Supabase Storage)</label>
            <div className="mt-1 flex flex-col gap-4">

              {/* Existing (kept) files */}
              {formData.keptDocuments && formData.keptDocuments.length > 0 && (
                <div className="space-y-2 px-6 pt-5 pb-6 border-2 border-slate-200 rounded-2xl bg-slate-50/50">
                  <p className="text-sm font-medium text-slate-600">เอกสารที่อัปโหลดแล้ว:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {formData.keptDocuments.map((doc: any, idx: number) => {
                      return (
                        <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium truncate max-w-[200px]" title={doc.url}>
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="truncate">{doc.name}</span>
                          </a>
                          <button type="button" onClick={() => setFormData({ ...formData, keptDocuments: formData.keptDocuments.filter((_: any, i: number) => i !== idx) })} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Newly selected files */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-600">เอกสารใหม่ที่จะอัปโหลด:</p>
                  <button
                    type="button"
                    onClick={() => setFiles([...(files || []), { id: crypto.randomUUID(), description: '', file: null }])}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-colors font-medium border border-blue-200/50"
                  >
                    <Plus className="w-4 h-4" /> เพิ่มเอกสาร
                  </button>
                </div>

                {files && files.map((fObj: any, idx: number) => (
                  <div key={fObj.id || idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-4 bg-white/50 border border-slate-200 rounded-2xl shadow-sm overflow-visible">
                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-xs font-semibold text-slate-600 ml-1">ชื่อเอกสาร / คำอธิบาย <span className="text-red-500">*</span></label>
                      <CreatableAutocomplete
                        options={dropdowns?.uploadFileTypes || []}
                        value={fObj.description}
                        required={true}
                        placeholder="เช่น หนังสือมอบอำนาจ"
                        onChange={(val: string) => {
                          const newFiles = [...files];
                          newFiles[idx].description = val;
                          setFiles(newFiles);
                        }}
                      />
                    </div>
                    <div className="sm:col-span-7 space-y-1">
                      <label className="text-xs font-semibold text-slate-600 ml-1">ไฟล์แนบ <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type="file"
                          required
                          onChange={(e) => {
                            const newFiles = [...files];
                            if (e.target.files && e.target.files.length > 0) {
                              newFiles[idx].file = e.target.files[0];
                              if (!newFiles[idx].description) {
                                newFiles[idx].description = e.target.files[0].name.split('.')[0];
                              }
                            } else {
                              newFiles[idx].file = null;
                            }
                            setFiles(newFiles);
                          }}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-1 flex justify-end pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newFiles = [...files];
                          newFiles.splice(idx, 1);
                          setFiles(newFiles);
                        }}
                        className="p-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {(!files || files.length === 0) && (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm bg-white/30">
                    ยังไม่มีเอกสารใหม่ (กดปุ่มลอยด้านบนขวาเพื่อเพิ่ม)
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700 ml-1">หมายเหตุ</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="ระบุหมายเหตุ หรือข้อมูลเพิ่มเติม" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400 resize-none" rows={3} />
          </div>
        </div>
      </section>

      {/* Specific Info Section */}
      <AnimatePresence mode="wait">
        {formData.taskType === 'car_crash' && (
          <motion.section
            key="car_crash"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white/50 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/40 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-500" /> ข้อมูลคดีรถยนต์ชนเสา
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">ทะเบียนรถ <span className="text-red-500">*</span></label>
                <input type="text" name="cc_licensePlate" required value={formData.cc_licensePlate} onChange={handleChange} placeholder="เช่น กท 1234" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">ชื่อ-นามสกุล คนขับ หรือ ประกัน <span className="text-red-500">*</span></label>
                <input type="text" name="cc_driverName" required value={formData.cc_driverName} onChange={handleChange} placeholder="ระบุชื่อ" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">หมายเลขอ้างอิง (CA) </label>
                <input type="text" name="cc_ReferenceNumber" value={formData.cc_ReferenceNumber} onChange={handleChange} placeholder="ระบุหมายเลขอ้างอิง (CA) " className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">ยอดเสียหาย (บาท) <span className="text-red-500">*</span></label>
                <input type="number" name="cc_damageAmount" required value={formData.cc_damageAmount} onChange={handleChange} placeholder="0.00" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400" />
              </div>
            </div>
          </motion.section>
        )}

        {formData.taskType === 'overdue_payment' && (
          <motion.section
            key="overdue_payment"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white/50 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/40 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-500" /> ข้อมูลคดีค่าไฟฟ้าค้างชำระ
              </h3>
              <button
                type="button"
                onClick={() => {
                  const newDetails = [...(formData.op_details || [])];
                  newDetails.push({ op_ReferenceNumber: '', op_OverdueBillStart: '', op_overdueBillEnd: '', op_amount: '' });
                  setFormData({ ...formData, op_details: newDetails });
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-colors font-medium"
              >
                <Plus className="w-4 h-4" /> เพิ่มรายการ CA
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">ชื่อนามสกุล <span className="text-red-500">*</span></label>
                <input type="text" name="op_customerName" required value={formData.op_customerName} onChange={handleChange} placeholder="ระบุชื่อนามสกุล" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder-slate-400" />
              </div>

              {(formData.op_details || []).map((detail: any, index: number) => (
                <div key={index} className="relative p-4 sm:p-8 rounded-3xl border border-slate-200 bg-white/80 shadow-sm space-y-6 transition-all hover:shadow-md w-full">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-lg">รายการที่ {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newDetails = [...formData.op_details];
                        newDetails.splice(index, 1);
                        setFormData({ ...formData, op_details: newDetails });
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">เลขที่อ้างอิง (CA) <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={detail.op_ReferenceNumber}
                        onChange={(e) => {
                          const newDetails = [...formData.op_details];
                          newDetails[index].op_ReferenceNumber = e.target.value;
                          setFormData({ ...formData, op_details: newDetails });
                        }}
                        placeholder="ระบุเลขที่อ้างอิง (CA)"
                        className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        required
                        value={detail.op_amount}
                        onChange={(e) => {
                          const newDetails = [...formData.op_details];
                          newDetails[index].op_amount = e.target.value;
                          setFormData({ ...formData, op_details: newDetails });
                        }}
                        placeholder="0.00"
                        className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">บิลที่ค้าง (ตั้งแต่) <span className="text-red-500">*</span></label>
                      <input
                        type="month"
                        required
                        value={detail.op_OverdueBillStart}
                        onChange={(e) => {
                          const newDetails = [...formData.op_details];
                          newDetails[index].op_OverdueBillStart = e.target.value;
                          setFormData({ ...formData, op_details: newDetails });
                        }}
                        className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">บิลที่ค้าง (ถึง) <span className="text-red-500">*</span></label>
                      <input
                        type="month"
                        required
                        value={detail.op_overdueBillEnd}
                        onChange={(e) => {
                          const newDetails = [...formData.op_details];
                          newDetails[index].op_overdueBillEnd = e.target.value;
                          setFormData({ ...formData, op_details: newDetails });
                        }}
                        className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {(!formData.op_details || formData.op_details.length === 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2 text-center py-4 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    ยังไม่มีข้อมูล CA (กดปุ่มเพิ่มรายการ CA ด้านบน)
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {formData.taskType === 'fine' && (
          <motion.section
            key="fine"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white/50 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/40 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-amber-500" /> ข้อมูลคดีค่าละเมิดการใช้ไฟฟ้า
              </h3>
              <button
                type="button"
                onClick={() => {
                  const newDetails = [...(formData.fn_details || [])];
                  newDetails.push({ fn_fineType: '', fn_fineTypeName: '', fn_ReferenceNumber: '', fn_OverdueBillStart: '', fn_OverdueBillEnd: '', fn_amount: '' });
                  setFormData({ ...formData, fn_details: newDetails });
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition-colors font-medium"
              >
                <Plus className="w-4 h-4" /> เพิ่มรายการ CA
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">ชื่อนามสกุล <span className="text-red-500">*</span></label>
                <input type="text" name="fn_customerName" required value={formData.fn_customerName} onChange={handleChange} placeholder="ระบุชื่อนามสกุล" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder-slate-400" />
              </div>

              {(formData.fn_details || []).map((detail: any, index: number) => (
                <div key={index} className="relative p-4 sm:p-8 rounded-3xl border border-slate-200 bg-white/80 shadow-sm space-y-6 transition-all hover:shadow-md w-full">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider bg-amber-50 px-3 py-1.5 rounded-lg">รายการที่ {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newDetails = [...formData.fn_details];
                        newDetails.splice(index, 1);
                        setFormData({ ...formData, fn_details: newDetails });
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    <div className="space-y-1.5 md:col-span-2 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">ประเภทค่าปรับ <span className="text-red-500">*</span></label>
                      <SearchableSelect
                        options={dropdowns.fineType}
                        value={detail.fn_fineType}
                        onChange={(val: string) => {
                          const newDetails = [...formData.fn_details];
                          newDetails[index].fn_fineType = val;
                          newDetails[index].fn_fineTypeName = dropdowns.fineType.find((o: any) => o.id === val)?.label || '';
                          setFormData({ ...formData, fn_details: newDetails });
                        }}
                        placeholder="เลือกประเภทค่าปรับ..."
                        required
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">หมายเลขอ้างอิง (CA) <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={detail.fn_ReferenceNumber}
                        onChange={(e) => {
                          const newDetails = [...formData.fn_details];
                          newDetails[index].fn_ReferenceNumber = e.target.value;
                          setFormData({ ...formData, fn_details: newDetails });
                        }}
                        placeholder="ระบุหมายเลขอ้างอิง (CA)"
                        className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">ค่าเบี้ยปรับละเมิด (บาท) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        required
                        value={detail.fn_amount}
                        onChange={(e) => {
                          const newDetails = [...formData.fn_details];
                          newDetails[index].fn_amount = e.target.value;
                          setFormData({ ...formData, fn_details: newDetails });
                        }}
                        placeholder="0.00"
                        className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">บิลเดือนเป็นช่วง (ตั้งแต่)</label>
                      <input
                        type="month"
                        value={detail.fn_OverdueBillStart}
                        onChange={(e) => {
                          const newDetails = [...formData.fn_details];
                          newDetails[index].fn_OverdueBillStart = e.target.value;
                          setFormData({ ...formData, fn_details: newDetails });
                        }}
                        className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">บิลเดือนเป็นช่วง (ถึง)</label>
                      <input
                        type="month"
                        value={detail.fn_OverdueBillEnd}
                        onChange={(e) => {
                          const newDetails = [...formData.fn_details];
                          newDetails[index].fn_OverdueBillEnd = e.target.value;
                          setFormData({ ...formData, fn_details: newDetails });
                        }}
                        className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {(!formData.fn_details || formData.fn_details.length === 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center py-4 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  ยังไม่มีข้อมูล CA (กดปุ่มเพิ่มรายการ CA ด้านบน)
                </div>
              )}

              <div className="space-y-2 mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-slate-700">ค่าอื่นๆ</label>
                  <button
                    type="button"
                    onClick={() => {
                      const newFees = formData.fn_additionalFees ? [...formData.fn_additionalFees] : [];
                      newFees.push({ name: '', amount: '' });
                      setFormData({ ...formData, fn_additionalFees: newFees });
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4" /> เพิ่มค่าอื่นๆ
                  </button>
                </div>

                <div className="space-y-3">
                  {(formData.fn_additionalFees || []).map((fee: any, idx: number) => (
                    <div key={idx} className="flex gap-3 items-end">
                      <input
                        type="text"
                        placeholder="ชื่อค่าธรรมเนียม (เช่น โทษขาด)"
                        value={fee.name || ''}
                        onChange={(e) => {
                          const newFees = [...(formData.fn_additionalFees || [])];
                          newFees[idx] = { ...newFees[idx], name: e.target.value };
                          setFormData({ ...formData, fn_additionalFees: newFees });
                        }}
                        className="flex-1 px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder-slate-400 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="จำนวนเงิน"
                        value={fee.amount || ''}
                        onChange={(e) => {
                          const newFees = [...(formData.fn_additionalFees || [])];
                          newFees[idx] = { ...newFees[idx], amount: e.target.value };
                          setFormData({ ...formData, fn_additionalFees: newFees });
                        }}
                        className="w-24 px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder-slate-400 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newFees = (formData.fn_additionalFees || []).filter((_: any, i: number) => i !== idx);
                          setFormData({ ...formData, fn_additionalFees: newFees });
                        }}
                        className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-200">
                <label className="text-sm font-semibold text-slate-800">รวมค่าเสียหายทั้งหมด</label>
                <div className="text-3xl font-bold text-amber-600">
                  {(() => {
                    const baseFineSum = (formData.fn_details || []).reduce((sum: number, d: any) => sum + (parseFloat(d.fn_amount) || 0), 0);
                    const additionalSum = (formData.fn_additionalFees || []).reduce((sum: number, fee: any) => sum + (parseFloat(fee.amount) || 0), 0);
                    return (baseFineSum + additionalSum).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  })()}
                  {' '}<span className="text-lg">บาท</span>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ── ลูกหนี้ราชการ ── */}
        {formData.taskType === 'gov_debt' && (
          <motion.section
            key="gov_debt"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white/50 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/40 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-violet-500" /> ข้อมูลคดีลูกหนี้ราชการ
              </h3>
              <button
                type="button"
                onClick={() => {
                  const newDetails = [...(formData.fngov_details || [])];
                  newDetails.push({ fngov_ReferenceNumber: '', fngov_agencyBranch: '', fngov_OverdueBillStart: '', fngov_overdueBillEnd: '', fngov_amount: '' });
                  setFormData({ ...formData, fngov_details: newDetails });
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-xl transition-colors font-medium"
              >
                <Plus className="w-4 h-4" /> เพิ่มรายการ CA
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">ชื่อนามสกุล <span className="text-red-500">*</span></label>
                <input type="text" name="fngov_customerName" required value={formData.fngov_customerName || ''} onChange={handleChange} placeholder="ระบุชื่อนามสกุล" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all placeholder-slate-400" />
              </div>

              {(formData.fngov_details || []).map((detail: any, index: number) => (
                <div key={index} className="relative p-4 sm:p-8 rounded-3xl border border-slate-200 bg-white/80 shadow-sm space-y-6 transition-all hover:shadow-md w-full">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-xs font-bold text-violet-600 uppercase tracking-wider bg-violet-50 px-3 py-1.5 rounded-lg">รายการที่ {index + 1}</span>
                    <button type="button" onClick={() => { const nd = [...formData.fngov_details]; nd.splice(index, 1); setFormData({ ...formData, fngov_details: nd }); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">เลขที่อ้างอิง (CA) <span className="text-red-500">*</span></label>
                      <input type="text" required value={detail.fngov_ReferenceNumber} onChange={(e) => { const nd = [...formData.fngov_details]; nd[index].fngov_ReferenceNumber = e.target.value; setFormData({ ...formData, fngov_details: nd }); }} placeholder="ระบุเลขที่อ้างอิง (CA)" className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">สาขาหน่วยงาน <span className="text-red-500">*</span></label>
                      <input type="text" required value={detail.fngov_agencyBranch || ''} onChange={(e) => { const nd = [...formData.fngov_details]; nd[index].fngov_agencyBranch = e.target.value; setFormData({ ...formData, fngov_details: nd }); }} placeholder="ระบุสาขาหน่วยงาน" className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                      <input type="number" required value={detail.fngov_amount} onChange={(e) => { const nd = [...formData.fngov_details]; nd[index].fngov_amount = e.target.value; setFormData({ ...formData, fngov_details: nd }); }} placeholder="0.00" className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">บิลที่ค้าง (ตั้งแต่) <span className="text-red-500">*</span></label>
                      <input type="month" required value={detail.fngov_OverdueBillStart} onChange={(e) => { const nd = [...formData.fngov_details]; nd[index].fngov_OverdueBillStart = e.target.value; setFormData({ ...formData, fngov_details: nd }); }} className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">บิลที่ค้าง (ถึง) <span className="text-red-500">*</span></label>
                      <input type="month" required value={detail.fngov_overdueBillEnd} onChange={(e) => { const nd = [...formData.fngov_details]; nd[index].fngov_overdueBillEnd = e.target.value; setFormData({ ...formData, fngov_details: nd }); }} className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
                    </div>
                  </div>
                </div>
              ))}

              {(!formData.fngov_details || formData.fngov_details.length === 0) && (
                <div className="text-center py-4 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  ยังไม่มีข้อมูล CA (กดปุ่มเพิ่มรายการ CA ด้านบน)
                </div>
              )}

              <div className="space-y-2 mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-slate-700">ค่าอื่นๆ</label>
                  <button type="button" onClick={() => { const nf = [...(formData.fngov_additionalFees || [])]; nf.push({ name: '', amount: '' }); setFormData({ ...formData, fngov_additionalFees: nf }); }} className="flex items-center gap-2 px-3 py-2 text-sm bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-xl transition-colors font-medium"><Plus className="w-4 h-4" /> เพิ่มค่าอื่นๆ</button>
                </div>
                <div className="space-y-3">
                  {(formData.fngov_additionalFees || []).map((fee: any, idx: number) => (
                    <div key={idx} className="flex gap-3 items-end">
                      <input type="text" placeholder="ชื่อค่าธรรมเนียม" value={fee.name || ''} onChange={(e) => { const nf = [...(formData.fngov_additionalFees || [])]; nf[idx] = { ...nf[idx], name: e.target.value }; setFormData({ ...formData, fngov_additionalFees: nf }); }} className="flex-1 px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all placeholder-slate-400 text-sm" />
                      <input type="number" placeholder="จำนวนเงิน" value={fee.amount || ''} onChange={(e) => { const nf = [...(formData.fngov_additionalFees || [])]; nf[idx] = { ...nf[idx], amount: e.target.value }; setFormData({ ...formData, fngov_additionalFees: nf }); }} className="w-24 px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all placeholder-slate-400 text-sm" />
                      <button type="button" onClick={() => { const nf = (formData.fngov_additionalFees || []).filter((_: any, i: number) => i !== idx); setFormData({ ...formData, fngov_additionalFees: nf }); }} className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ── ค่าละเมิดบิทคอยน์ ── */}
        {formData.taskType === 'fine_btc' && (
          <motion.section
            key="fine_btc"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white/50 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/40 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Hash className="w-5 h-5 text-orange-500" /> ข้อมูลคดีค่าละเมิดบิทคอยน์
              </h3>
              <button type="button" onClick={() => { const nd = [...(formData.fnbtc_details || [])]; nd.push({ fnbtc_ReferenceNumber: '', fnbtc_OverdueBillStart: '', fnbtc_overdueBillEnd: '', fnbtc_amount: '' }); setFormData({ ...formData, fnbtc_details: nd }); }} className="flex items-center gap-2 px-3 py-2 text-sm bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-xl transition-colors font-medium"><Plus className="w-4 h-4" /> เพิ่มรายการ CA</button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">ชื่อนามสกุล <span className="text-red-500">*</span></label>
                <input type="text" name="fnbtc_customerName" required value={formData.fnbtc_customerName || ''} onChange={handleChange} placeholder="ระบุชื่อนามสกุล" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder-slate-400" />
              </div>

              {(formData.fnbtc_details || []).map((detail: any, index: number) => (
                <div key={index} className="relative p-4 sm:p-8 rounded-3xl border border-slate-200 bg-white/80 shadow-sm space-y-6 transition-all hover:shadow-md w-full">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-wider bg-orange-50 px-3 py-1.5 rounded-lg">รายการที่ {index + 1}</span>
                    <button type="button" onClick={() => { const nd = [...formData.fnbtc_details]; nd.splice(index, 1); setFormData({ ...formData, fnbtc_details: nd }); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">เลขที่อ้างอิง (CA) <span className="text-red-500">*</span></label>
                      <input type="text" required value={detail.fnbtc_ReferenceNumber} onChange={(e) => { const nd = [...formData.fnbtc_details]; nd[index].fnbtc_ReferenceNumber = e.target.value; setFormData({ ...formData, fnbtc_details: nd }); }} placeholder="ระบุเลขที่อ้างอิง (CA)" className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                      <input type="number" required value={detail.fnbtc_amount} onChange={(e) => { const nd = [...formData.fnbtc_details]; nd[index].fnbtc_amount = e.target.value; setFormData({ ...formData, fnbtc_details: nd }); }} placeholder="0.00" className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">บิลที่ค้าง (ตั้งแต่) <span className="text-red-500">*</span></label>
                      <input type="month" required value={detail.fnbtc_OverdueBillStart} onChange={(e) => { const nd = [...formData.fnbtc_details]; nd[index].fnbtc_OverdueBillStart = e.target.value; setFormData({ ...formData, fnbtc_details: nd }); }} className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-xs font-semibold text-slate-600 ml-1">บิลที่ค้าง (ถึง) <span className="text-red-500">*</span></label>
                      <input type="month" required value={detail.fnbtc_overdueBillEnd} onChange={(e) => { const nd = [...formData.fnbtc_details]; nd[index].fnbtc_overdueBillEnd = e.target.value; setFormData({ ...formData, fnbtc_details: nd }); }} className="w-full px-4 py-3 text-base bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
                    </div>
                  </div>
                </div>
              ))}

              {(!formData.fnbtc_details || formData.fnbtc_details.length === 0) && (
                <div className="text-center py-4 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  ยังไม่มีข้อมูล CA (กดปุ่มเพิ่มรายการ CA ด้านบน)
                </div>
              )}

              <div className="space-y-2 mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-slate-700">ค่าอื่นๆ</label>
                  <button type="button" onClick={() => { const nf = [...(formData.fnbtc_additionalFees || [])]; nf.push({ name: '', amount: '' }); setFormData({ ...formData, fnbtc_additionalFees: nf }); }} className="flex items-center gap-2 px-3 py-2 text-sm bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-xl transition-colors font-medium"><Plus className="w-4 h-4" /> เพิ่มค่าอื่นๆ</button>
                </div>
                <div className="space-y-3">
                  {(formData.fnbtc_additionalFees || []).map((fee: any, idx: number) => (
                    <div key={idx} className="flex gap-3 items-end">
                      <input type="text" placeholder="ชื่อค่าธรรมเนียม" value={fee.name || ''} onChange={(e) => { const nf = [...(formData.fnbtc_additionalFees || [])]; nf[idx] = { ...nf[idx], name: e.target.value }; setFormData({ ...formData, fnbtc_additionalFees: nf }); }} className="flex-1 px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder-slate-400 text-sm" />
                      <input type="number" placeholder="จำนวนเงิน" value={fee.amount || ''} onChange={(e) => { const nf = [...(formData.fnbtc_additionalFees || [])]; nf[idx] = { ...nf[idx], amount: e.target.value }; setFormData({ ...formData, fnbtc_additionalFees: nf }); }} className="w-24 px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder-slate-400 text-sm" />
                      <button type="button" onClick={() => { const nf = (formData.fnbtc_additionalFees || []).filter((_: any, i: number) => i !== idx); setFormData({ ...formData, fnbtc_additionalFees: nf }); }} className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ── ค่าละเมิดสายสื่อสาร ── */}
        {formData.taskType === 'fine_cable' && (
          <motion.section
            key="fine_cable"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white/50 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/40 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-cyan-500" /> ข้อมูลคดีค่าละเมิดสายสื่อสาร
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">ชื่อนามสกุล <span className="text-red-500">*</span></label>
                <input type="text" name="fncable_customerName" required value={formData.fncable_customerName || ''} onChange={handleChange} placeholder="ระบุชื่อนามสกุล" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all placeholder-slate-400" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                <input type="number" name="fncable_amount" required value={formData.fncable_amount || ''} onChange={handleChange} placeholder="0.00" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all placeholder-slate-400" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">วันที่ตรวจพบ <span className="text-red-500">*</span></label>
                <input type="date" name="fncable_detectedDate" required value={formData.fncable_detectedDate || ''} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all" />
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

// Edit Modal Component
const EditModal = ({ caseData, onClose, dropdowns, onSaveSuccess }: any) => {
  // Ensure op_details is always an array
  const parseOpDetails = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Ensure fn_details is always an array
  const parseFnDetails = (val: any): any[] => {
    let details: any[] = [];
    if (Array.isArray(val)) {
      details = val;
    } else if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        details = Array.isArray(parsed) ? parsed : [];
      } catch {
        details = [];
      }
    }

    // Auto-resolve fineType names if missing
    return details.map(d => {
      if (d.fn_fineType && !d.fn_fineTypeName) {
        const found = dropdowns.fineType.find((o: any) => o.id === d.fn_fineType);
        return { ...d, fn_fineTypeName: found ? found.label : '' };
      }
      return d;
    });
  };

  // Ensure fn_additionalFees is always an array
  const parseFnAdditionalFees = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const [formData, setFormData] = useState({
    taskType: caseData.taskType || "car_crash",
    source: caseData.source || "",
    receiveDate: caseData.receiveDate || "",
    docNumber: caseData.docNumber || "",
    docState: caseData.docState || "",
    returnDocNumber: caseData.returnDocNumber || "",
    approvalDocNumber: caseData.approvalDocNumber || "",
    taskState: caseData.taskState || "",
    lawyer: caseData.lawyer || "",
    cc_licensePlate: caseData.cc_licensePlate || caseData.licensePlate || "",
    cc_driverName: caseData.cc_driverName || caseData.driverName || "",
    cc_ReferenceNumber: caseData.cc_ReferenceNumber || caseData.referenceNumber || "",
    cc_damageAmount: caseData.cc_damageAmount || caseData.damageAmount || "",
    op_ReferenceNumber: caseData.op_ReferenceNumber || caseData.referenceNumber || "",
    op_customerName: caseData.op_customerName || caseData.driverName || "",
    op_OverdueBillStart: caseData.op_OverdueBillStart || caseData.overdueBillStart || "",
    op_overdueBillEnd: caseData.op_overdueBillEnd || caseData.overdueBillEnd || "",
    op_amount: caseData.op_amount || caseData.amount || "",
    op_details: (() => {
      const details = parseOpDetails(caseData.op_details);
      if (details.length === 0 && (caseData.op_ReferenceNumber || caseData.op_amount || caseData.referenceNumber || caseData.amount)) {
        return [{
          op_ReferenceNumber: caseData.op_ReferenceNumber || caseData.referenceNumber || "",
          op_OverdueBillStart: caseData.op_OverdueBillStart || caseData.overdueBillStart || "",
          op_overdueBillEnd: caseData.op_overdueBillEnd || caseData.overdueBillEnd || "",
          op_amount: caseData.op_amount || caseData.amount || ""
        }];
      }
      return details;
    })(),
    fn_customerName: caseData.fn_customerName || caseData.driverName || "",
    fn_fineType: caseData.fn_fineType || "",
    fn_fineTypeName: caseData.fn_fineTypeName || "",
    fn_ReferenceNumber: caseData.fn_ReferenceNumber || caseData.referenceNumber || "",
    fn_OverdueBillStart: caseData.fn_OverdueBillStart || caseData.overdueBillStart || "",
    fn_OverdueBillEnd: caseData.fn_OverdueBillEnd || caseData.overdueBillEnd || "",
    fn_amount: caseData.fn_amount || caseData.amount || "",
    fn_additionalFees: parseFnAdditionalFees(caseData.fn_additionalFees),
    fn_details: (() => {
      const details = parseFnDetails(caseData.fn_details);
      if (details.length === 0 && (caseData.fn_ReferenceNumber || caseData.fn_amount || caseData.referenceNumber || caseData.amount)) {
        return [{
          fn_fineType: caseData.fn_fineType || "",
          fn_fineTypeName: caseData.fn_fineTypeName || "",
          fn_ReferenceNumber: caseData.fn_ReferenceNumber || caseData.referenceNumber || "",
          fn_OverdueBillStart: caseData.fn_OverdueBillStart || caseData.overdueBillStart || "",
          fn_OverdueBillEnd: caseData.fn_OverdueBillEnd || caseData.overdueBillEnd || "",
          fn_amount: caseData.fn_amount || caseData.amount || ""
        }];
      }
      return details;
    })(),
    // gov_debt fields
    fngov_customerName: caseData.fngov_customerName || "",
    fngov_details: (() => { try { return Array.isArray(caseData.fngov_details) ? caseData.fngov_details : JSON.parse(caseData.fngov_details || '[]'); } catch { return []; } })(),
    fngov_additionalFees: (() => { try { return Array.isArray(caseData.fngov_additionalFees) ? caseData.fngov_additionalFees : JSON.parse(caseData.fngov_additionalFees || '[]'); } catch { return []; } })(),
    // fine_btc fields
    fnbtc_customerName: caseData.fnbtc_customerName || "",
    fnbtc_details: (() => { try { return Array.isArray(caseData.fnbtc_details) ? caseData.fnbtc_details : JSON.parse(caseData.fnbtc_details || '[]'); } catch { return []; } })(),
    fnbtc_additionalFees: (() => { try { return Array.isArray(caseData.fnbtc_additionalFees) ? caseData.fnbtc_additionalFees : JSON.parse(caseData.fnbtc_additionalFees || '[]'); } catch { return []; } })(),
    // fine_cable fields
    fncable_customerName: caseData.fncable_customerName || "",
    fncable_amount: caseData.fncable_amount || "",
    fncable_detectedDate: caseData.fncable_detectedDate || "",
    fncable_details: (() => { try { return Array.isArray(caseData.fncable_details) ? caseData.fncable_details : JSON.parse(caseData.fncable_details || '[]'); } catch { return []; } })(),
    fncable_additionalFees: (() => { try { return Array.isArray(caseData.fncable_additionalFees) ? caseData.fncable_additionalFees : JSON.parse(caseData.fncable_additionalFees || '[]'); } catch { return []; } })(),
    notes: caseData.notes || "",
    courtDocument: caseData.courtDocument || "",
    keptDocuments: parseCourtDocuments(caseData.courtDocument),
  });
  const [files, setFiles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isFinishOnArchive, setIsFinishOnArchive] = useState(false);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'keptDocuments' || key === 'courtDocument' || key === 'courtDocuments') return;
        if (Array.isArray(value)) {
          data.append(key, JSON.stringify(value));
        } else {
          data.append(key, value as string);
        }
      });

      // Calculate and add total fine amount (base + additional fees)
      if (formData.taskType === 'fine') {
        const baseFineSum = (formData.fn_details || []).reduce((sum: number, d: any) => sum + (parseFloat(d.fn_amount) || 0), 0);
        const additionalSum = (formData.fn_additionalFees || []).reduce((sum: number, fee: any) => sum + (parseFloat(fee.amount) || 0), 0);
        const totalAmount = baseFineSum + additionalSum;
        data.append('fn_totalAmount', String(totalAmount));
      }

      if (files && files.length > 0) {
        files.forEach((f: any) => {
          if (f.file) {
            data.append("courtDocuments", f.file);
            data.append("documentDescriptions", f.description || f.file.name);
          }
        });
      }
      data.append("keptDocuments", JSON.stringify(formData.keptDocuments || []));

      const response = await fetch(`/api/cases/${caseData.id}`, {
        method: "PUT",
        body: data,
      });

      if (response.ok) {
        onSaveSuccess();
      }
    } catch (error) {
      console.error("Error updating case:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = () => {
    setIsArchiveConfirmOpen(true);
  };

  const confirmArchive = async () => {
    setIsArchiving(true);
    try {
      const response = await fetch(`/api/cases/${caseData.id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFinish: isFinishOnArchive })
      });
      if (response.ok) {
        onSaveSuccess();
      } else {
        alert('Failed to archive case.');
        console.error('Failed to archive case:', await response.text());
      }
    } catch (error) {
      console.error("Error archiving case:", error);
      alert('An error occurred while archiving the case.');
    } finally {
      setIsArchiving(false);
      setIsArchiveConfirmOpen(false);
      setIsFinishOnArchive(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/cases/${caseData.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onSaveSuccess();
      } else {
        alert('Failed to delete the case.');
        console.error('Failed to delete case:', await response.text());
      }
    } catch (error) {
      alert('An error occurred while deleting the case.');
      console.error('Error deleting case:', error);
    } finally {
      setIsDeleting(false);
      setIsConfirmOpen(false);
    }
  };

  const handleDownloadWord = async () => {
    setIsDownloadingWord(true);
    try {
      await downloadCaseWord(caseData.id);
    } catch (error) {
      console.error('Error downloading Word file:', error);
      alert('ไม่สามารถดาวน์โหลดไฟล์ Word ได้');
    } finally {
      setIsDownloadingWord(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-all">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#F2F2F7]/95 sm:bg-[#F2F2F7]/95 backdrop-blur-3xl sm:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-5xl h-[95dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col border border-white/40"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 bg-white/50 border-b border-slate-200/50 w-full">
          <h2 className="text-lg sm:text-2xl font-semibold text-slate-800 flex items-center gap-2 min-w-0">
            <Edit2 className="w-6 h-6 text-indigo-500" />
            <span className="min-w-0 break-words">แก้ไขข้อมูลคดี {caseData.docNumber}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadWord}
              disabled={isDownloadingWord}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors text-sm font-medium disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="w-4 h-4" /> {isDownloadingWord ? "กำลังสร้าง..." : "ดาวน์โหลด Word"}
            </button>
            <button
              onClick={handleArchive}
              disabled={isArchiving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors text-sm font-medium whitespace-nowrap"
            >
              <Archive className="w-4 h-4" /> {isArchiving ? "กำลังจัดเก็บ..." : "จัดเก็บ"}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors">
              <X className="w-6 h-6 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <form id="edit-form" onSubmit={handleSubmit}>
            <CaseFormFields
              formData={formData}
              setFormData={setFormData}
              files={files}
              setFiles={setFiles}
              dropdowns={dropdowns}
              isEditMode={true}
            />
          </form>
        </div>

        <div className="p-4 sm:p-6 bg-white/80 backdrop-blur-md border-t border-slate-200/50 flex flex-col-reverse sm:flex-row gap-3 sm:gap-0 sm:justify-between sm:items-center shrink-0 safe-pb">
          <div className="w-full sm:w-auto">
            <button
              onClick={() => setIsConfirmOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl sm:rounded-xl transition-colors text-sm font-medium w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4" /> ลบข้อมูล
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <button type="button" onClick={onClose} className="px-6 py-3.5 sm:py-3 rounded-2xl font-medium text-slate-600 bg-slate-100 sm:bg-transparent hover:bg-slate-200/50 transition-colors w-full sm:w-auto">
              ยกเลิก
            </button>
            <button type="submit" form="edit-form" disabled={isSubmitting} className="px-6 py-3.5 sm:py-3 rounded-2xl font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/20 transition-all disabled:opacity-70 w-full sm:w-auto">
              {isSubmitting ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
            </button>
          </div>
        </div>
      </motion.div>
      <AnimatePresence>
        {isConfirmOpen && (
          <ConfirmModal
            isOpen={isConfirmOpen}
            onClose={() => setIsConfirmOpen(false)}
            onConfirm={handleDelete}
            title="ยืนยันการลบ"
            isConfirming={isDeleting}
          >
            <p>คุณแน่ใจหรือไม่ว่าต้องการลบคดีนี้อย่างถาวร?</p>
            <p className="mt-2 text-sm text-slate-500">การกระทำนี้ไม่สามารถย้อนกลับได้ และข้อมูลจะถูกลบออกจาก Google Sheet ด้วย</p>
          </ConfirmModal>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isArchiveConfirmOpen && (
          <ConfirmModal
            isOpen={isArchiveConfirmOpen}
            onClose={() => setIsArchiveConfirmOpen(false)}
            onConfirm={confirmArchive}
            title="ยืนยันการจัดเก็บ"
            isConfirming={isArchiving}
            variant="warning"
          >
            <p>คุณแน่ใจหรือไม่ว่าต้องการจัดเก็บ (Archive) คดีนี้?</p>
            <div className="flex items-center gap-2 mt-4 bg-slate-100 p-3 rounded-lg">
              <input
                type="checkbox"
                id="isFinishCheckbox"
                checked={isFinishOnArchive}
                onChange={(e) => setIsFinishOnArchive(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="isFinishCheckbox" className="text-sm text-slate-700">
                งานเสร็จแล้วใช่หรือไม่?
              </label>
            </div>
            <p className="mt-4 text-sm text-slate-500">คุณยังสามารถค้นหาและดูคดีที่จัดเก็บไว้ได้ในภายหลัง</p>
          </ConfirmModal>
        )}
      </AnimatePresence>
    </div>
  );
};

// Stats Dashboard Component
const StatsDashboard = ({ cases }: { cases: any[] }) => {
  const isArchivedVal = (v: any) => { const s = String(v).trim().toLowerCase(); return s === 'true' || s === '1' || s === 'yes'; };
  const activeCases = cases.filter(c => !isArchivedVal(c.isArchived));
  const archivedCases = cases.filter(c => isArchivedVal(c.isArchived));

  // Type breakdown
  const carCrash = activeCases.filter(c => c.taskType === 'car_crash');
  const overdue = activeCases.filter(c => c.taskType === 'overdue_payment');
  const fine = activeCases.filter(c => c.taskType === 'fine');

  // Status breakdown
  const byStatus = (name: string) => activeCases.filter(c => c.taskStateName === name).length;

  // Financial totals
  const totalCarDamage = carCrash.reduce((s, c) => s + (parseFloat(c.cc_damageAmount) || 0), 0);
  const totalOverdue = overdue.reduce((s, c) => {
    if (Array.isArray(c.op_details) && c.op_details.length > 0) {
      return s + c.op_details.reduce((sum: number, d: any) => sum + (parseFloat(d.op_amount) || 0), 0);
    }
    return s + (parseFloat(c.op_amount) || 0);
  }, 0);
  const totalFine = fine.reduce((s, c) => {
    if (parseFloat(c.fn_totalAmount)) return s + parseFloat(c.fn_totalAmount);
    let base = Array.isArray(c.fn_details) && c.fn_details.length > 0
      ? c.fn_details.reduce((sum: number, d: any) => sum + (parseFloat(d.fn_amount) || 0), 0)
      : (parseFloat(c.fn_amount) || 0);
    let add = Array.isArray(c.fn_additionalFees)
      ? c.fn_additionalFees.reduce((sum: number, f: any) => sum + (parseFloat(f.amount) || 0), 0)
      : 0;
    return s + base + add;
  }, 0);
  const grandTotal = totalCarDamage + totalOverdue + totalFine;

  // Lawyer workload
  const lawyerMap: Record<string, number> = {};
  activeCases.forEach(c => { if (c.lawyerName) lawyerMap[c.lawyerName] = (lawyerMap[c.lawyerName] || 0) + 1; });
  const lawyerData = Object.entries(lawyerMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // Source breakdown
  const sourceMap: Record<string, number> = {};
  activeCases.forEach(c => { if (c.sourceName) sourceMap[c.sourceName] = (sourceMap[c.sourceName] || 0) + 1; });
  const sourceData = Object.entries(sourceMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const typeData = [
    { name: 'รถยนต์ชนเสา', value: carCrash.length },
    { name: 'ค่าไฟฟ้าค้างชำระ', value: overdue.length },
    { name: 'ค่าละเมิดการใช้ไฟฟ้า', value: fine.length },
  ];

  const statusChartData = [
    { name: 'รับเรื่อง', value: byStatus('รับเรื่อง'), color: '#3b82f6' },
    { name: 'กำลังดำเนินการ', value: byStatus('กำลังดำเนินการ'), color: '#f59e0b' },
    { name: 'เสร็จสิ้น', value: byStatus('เสร็จสิ้น'), color: '#10b981' },
  ];

  const TYPE_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];
  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const StatCard = ({ icon, label, value, sub, color }: any) => (
    <div className={`bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4`}>
      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-slate-800 leading-tight">{value}</p>
        {sub && <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 leading-tight">{sub}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">แดชบอร์ด</h2>
        <p className="text-slate-500 mt-1">ภาพรวมระบบจัดการคดีทั้งหมด</p>
      </div>

      {/* ── ส่วนผู้บริหาร ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
          <h3 className="text-base font-semibold text-slate-700">ภาพรวมสำหรับผู้บริหาร</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<LayoutDashboard className="w-5 h-5 sm:w-7 sm:h-7 text-indigo-600" />} label="คดีที่กำลังดำเนินการ" value={activeCases.length} sub={`จัดเก็บแล้ว ${archivedCases.length} คดี`} color="bg-indigo-50" />
          <StatCard icon={<Car className="w-5 h-5 sm:w-7 sm:h-7 text-blue-600" />} label="รถยนต์ชนเสา" value={carCrash.length} sub={`${fmt(totalCarDamage)} บาท`} color="bg-blue-50" />
          <StatCard icon={<CreditCard className="w-5 h-5 sm:w-7 sm:h-7 text-emerald-600" />} label="ค่าไฟฟ้าค้างชำระ" value={overdue.length} sub={`${fmt(totalOverdue)} บาท`} color="bg-emerald-50" />
          <StatCard icon={<Gavel className="w-5 h-5 sm:w-7 sm:h-7 text-amber-600" />} label="ค่าละเมิดการใช้ไฟฟ้า" value={fine.length} sub={`${fmt(totalFine)} บาท`} color="bg-amber-50" />
        </div>

        {/* มูลค่ารวม */}
        <div className="mt-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-indigo-100 text-sm font-medium">มูลค่าความเสียหายรวมทั้งหมด (Active)</p>
            <p className="text-4xl font-bold mt-1">{fmt(grandTotal)} <span className="text-2xl font-normal text-indigo-200">บาท</span></p>
          </div>
          <div className="flex gap-6 text-center">
            <div><p className="text-indigo-200 text-xs">รถชน</p><p className="text-xl font-bold">{fmt(totalCarDamage)}</p></div>
            <div className="w-px bg-indigo-400/50" />
            <div><p className="text-indigo-200 text-xs">ค่าไฟค้าง</p><p className="text-xl font-bold">{fmt(totalOverdue)}</p></div>
            <div className="w-px bg-indigo-400/50" />
            <div><p className="text-indigo-200 text-xs">ค่าปรับ</p><p className="text-xl font-bold">{fmt(totalFine)}</p></div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie - ประเภทคดี */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl p-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">สัดส่วนประเภทคดี</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                  {typeData.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v} คดี`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {typeData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[i] }} />
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-semibold text-slate-800">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ต้นทาง */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl p-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">คดีตามต้นทาง</h4>
          {sourceData.length === 0 ? (
            <p className="text-slate-400 text-sm text-center mt-8">ไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-3 mt-2">
              {sourceData.map((s, i) => {
                const pct = activeCases.length > 0 ? Math.round((s.value / activeCases.length) * 100) : 0;
                const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'];
                return (
                  <div key={s.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 truncate max-w-[160px]">{s.name}</span>
                      <span className="font-semibold text-slate-800 shrink-0 ml-2">{s.value} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[i % colors.length]} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── ส่วนผู้ปฏิบัติงาน ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full" />
          <h3 className="text-base font-semibold text-slate-700">ภาพรวมสำหรับผู้ปฏิบัติงาน</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ภาระงานทนาย */}
          <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl p-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" /> ภาระงานแต่ละทนาย
            </h4>
            {lawyerData.length === 0 ? (
              <p className="text-slate-400 text-sm text-center mt-4">ไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-3">
                {lawyerData.map((l, i) => {
                  const pct = activeCases.length > 0 ? Math.round((l.count / activeCases.length) * 100) : 0;
                  return (
                    <div key={l.name} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700 font-medium truncate">{l.name}</span>
                          <span className="text-slate-500 shrink-0 ml-2">{l.count} คดี</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* คดีที่ต้องติดตาม */}
          <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl p-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-400" /> คดีที่ต้องติดตาม (ยังไม่เสร็จ)
            </h4>
            {(() => {
              const pending = activeCases.filter(c => c.taskStateName !== 'เสร็จสิ้น').slice(0, 6);
              if (pending.length === 0) return <p className="text-slate-400 text-sm text-center mt-4">ไม่มีคดีค้างดำเนินการ 🎉</p>;
              return (
                <div className="space-y-2">
                  {pending.map(c => {
                    const name = c.taskType === 'car_crash' ? c.cc_driverName : c.taskType === 'overdue_payment' ? c.op_customerName : c.fn_customerName;
                    return (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-white/60 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 min-w-0">
                          {c.taskType === 'car_crash' ? <Car className="w-4 h-4 text-blue-400 shrink-0" /> : c.taskType === 'fine' ? <Gavel className="w-4 h-4 text-amber-400 shrink-0" /> : <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{c.docNumber}</p>
                            <p className="text-xs text-slate-400 truncate">{name || '-'}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.taskStateName === 'กำลังดำเนินการ' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{c.taskStateName || '-'}</span>
                          <span className="text-xs text-slate-400">{c.lawyerName || '-'}</span>
                        </div>
                      </div>
                    );
                  })}
                  {activeCases.filter(c => c.taskStateName !== 'เสร็จสิ้น').length > 6 && (
                    <p className="text-xs text-slate-400 text-center pt-1">และอีก {activeCases.filter(c => c.taskStateName !== 'เสร็จสิ้น').length - 6} คดี...</p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Kanban Board Component
const KanbanBoard = ({ cases, dropdowns, onUpdate }: { cases: any[], dropdowns: Dropdowns, onUpdate: () => void }) => {
  const isArchivedValue = (value: any) => {
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    }
    return Boolean(value);
  };

  const activeCases = cases.filter(c => !isArchivedValue(c.isArchived));
  const [selectedCase, setSelectedCase] = useState<any>(null);

  const columns = [
    { id: '1', title: 'รับเรื่อง', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { id: '2', title: 'กำลังดำเนินการ', color: 'bg-amber-50 border-amber-200 text-amber-700' },
    { id: '3', title: 'เสร็จสิ้น', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' }
  ];

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatusId = destination.droppableId;
    const newStatusName = columns.find(c => c.id === newStatusId)?.title || '';

    try {
      await fetch(`/api/cases/${draggableId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskState: newStatusId, taskStateName: newStatusName })
      });
      onUpdate();
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">กระดานงาน (Kanban)</h2>
        <p className="text-slate-500 mt-2">ลากและวางการ์ดเพื่อเปลี่ยนสถานะงาน</p>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 flex-1 overflow-x-auto pb-4">
          {columns.map(column => {
            const columnCases = activeCases.filter(c => c.taskState === column.id);
            return (
              <div key={column.id} className="flex flex-col min-w-[320px] w-[320px] bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm">
                <div className={`p-4 m-2 rounded-2xl border ${column.color} font-semibold flex justify-between items-center`}>
                  <span>{column.title}</span>
                  <span className="bg-white/50 px-2.5 py-0.5 rounded-full text-sm">{columnCases.length}</span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-3 overflow-y-auto transition-colors rounded-b-3xl ${snapshot.isDraggingOver ? 'bg-slate-100/50' : ''}`}
                    >
                      {columnCases.map((c, index) => (
                        // @ts-ignore
                        <Draggable key={String(c.id)} draggableId={String(c.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => setSelectedCase(c)}
                              style={{
                                ...(provided.draggableProps.style as any),
                                zIndex: snapshot.isDragging ? 9999 : undefined,
                              }}
                              className={`mb-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm transition-all ${snapshot.isDragging ? 'shadow-xl' : 'hover:shadow-md hover:border-blue-300'
                                }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-slate-500">{c.docNumber}</span>
                                {c.taskType === 'car_crash' ? (
                                  <span className="bg-blue-50 text-blue-600 p-1.5 rounded-lg"><Car className="w-3.5 h-3.5" /></span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg"><CreditCard className="w-3.5 h-3.5" /></span>
                                )}
                              </div>
                              <h4 className="font-semibold text-slate-800 mb-1 line-clamp-1">
                                {c.taskType === 'car_crash' ? c.driverName : c.referenceNumber}
                              </h4>
                              <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {c.sourceName}</span>
                                <span>{c.lawyerName}</span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <AnimatePresence>
        {selectedCase && (
          <EditModal
            caseData={selectedCase}
            dropdowns={dropdowns}
            onClose={() => setSelectedCase(null)}
            onSaveSuccess={() => {
              setSelectedCase(null);
              onUpdate();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Case Detail Modal (Read-only)
const CaseDetailModal = ({ caseData, onClose, onUnarchive }: { caseData: any; onClose: () => void; onUnarchive?: () => void }) => {
  const [isUnarchiving, setIsUnarchiving] = useState(false);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);

  const handleUnarchive = async () => {
    setIsUnarchiving(true);
    try {
      const res = await fetch(`/api/cases/${caseData.id}/unarchive`, { method: 'PATCH' });
      if (res.ok) {
        onUnarchive?.();
        onClose();
      } else {
        alert('เกิดข้อผิดพลาดในการยกเลิกการจัดเก็บ');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setIsUnarchiving(false);
    }
  };
  const Field = ({ label, value }: { label: string; value?: string }) => (
    <div className="space-y-1">
      <p className="text-[11px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm sm:text-base text-slate-800 font-medium bg-white/60 px-3 py-2 rounded-xl border border-slate-100 break-words leading-relaxed">{value || '-'}</p>
    </div>
  );

  const parseFees = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
  };

  const handleDownloadWord = async () => {
    setIsDownloadingWord(true);
    try {
      await downloadCaseWord(caseData.id);
    } catch (error) {
      console.error('Error downloading Word file:', error);
      alert('ไม่สามารถดาวน์โหลดไฟล์ Word ได้');
    } finally {
      setIsDownloadingWord(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-all">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#F2F2F7]/95 sm:bg-[#F2F2F7]/95 backdrop-blur-3xl sm:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-3xl h-[95dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col border border-white/40"
      >
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-5 sm:p-6 bg-white/50 border-b border-slate-200/50">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800 flex items-center gap-2 min-w-0">
            <FolderArchive className="w-5 h-5 text-indigo-500" />
            <span className="min-w-0 break-words">รายละเอียดคดี {caseData.docNumber}</span>
          </h2>
          <div className="flex flex-wrap items-stretch gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadWord}
              disabled={isDownloadingWord}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-colors disabled:opacity-50 whitespace-nowrap flex-1 sm:flex-none"
            >
              <Download className="w-4 h-4" />
              {isDownloadingWord ? 'กำลังสร้าง...' : 'ดาวน์โหลด Word'}
            </button>
            {caseData.isFinish ? (
              <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 max-w-full whitespace-normal break-words leading-tight flex-1 sm:flex-none">
                <CheckCircle2 className="w-3.5 h-3.5" /> เสร็จสิ้นแล้ว
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 max-w-full whitespace-normal break-words leading-tight flex-1 sm:flex-none">
                <XCircle className="w-3.5 h-3.5" /> ยังไม่เสร็จ
              </span>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors self-start sm:self-auto">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* General Info */}
          <section className="bg-white/50 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" /> ข้อมูลทั่วไป
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="ประเภทงาน" value={
                caseData.taskType === 'car_crash' ? 'รถยนต์ชนเสา' :
                caseData.taskType === 'overdue_payment' ? 'ค่าไฟฟ้าค้างชำระ' :
                caseData.taskType === 'fine' ? 'ค่าละเมิดการใช้ไฟฟ้า' :
                caseData.taskType === 'gov_debt' ? 'ลูกหนี้ราชการ' :
                caseData.taskType === 'fine_btc' ? 'ค่าละเมิดบิทคอยน์' :
                caseData.taskType === 'fine_cable' ? 'ค่าละเมิดสายสื่อสาร' : caseData.taskType
              } />
              <Field label="ต้นทางเอกสาร" value={caseData.sourceName} />
              <Field label="วันที่รับเรื่อง" value={caseData.receiveDate} />
              <Field label="เลขที่หนังสือ" value={caseData.docNumber} />
              <Field label="ผลการตรวจเอกสาร" value={caseData.docStateName} />
              <Field label="เลขที่คืนเอกสาร" value={caseData.returnDocNumber} />
              <Field label="เลขที่ อนุมัติฟ้อง" value={caseData.approvalDocNumber} />
              <Field label="สถานะงาน" value={caseData.taskStateName} />
              <Field label="ผู้รับผิดชอบ" value={caseData.lawyerName} />
              {caseData.notes && <div className="sm:col-span-2"><Field label="หมายเหตุ" value={caseData.notes} /></div>}
              {caseData.courtDocument && (
                <div className="sm:col-span-2 space-y-2">
                  <p className="text-[11px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide">เอกสารจากศาล</p>
                  <div className="flex flex-wrap gap-2">
                    {parseCourtDocuments(caseData.courtDocument).map((doc: any, idx: number) => (
                      <a
                        key={idx}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl border border-indigo-100 transition-colors font-medium max-w-full break-words"
                        title={doc.url}
                      >
                        <FileText className="w-4 h-4 shrink-0" /> {doc.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Type-specific Info */}
          {caseData.taskType === 'car_crash' && (
            <section className="bg-white/50 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Car className="w-4 h-4 text-blue-400" /> ข้อมูลคดีรถยนต์ชนเสา
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="ทะเบียนรถ" value={caseData.cc_licensePlate} />
                <Field label="ชื่อ-นามสกุล คนขับ / ประกัน" value={caseData.cc_driverName} />
                <Field label="หมายเลขอ้างอิง (CA)" value={caseData.cc_ReferenceNumber} />
                <Field label="ยอดเสียหาย (บาท)" value={caseData.cc_damageAmount ? Number(caseData.cc_damageAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : undefined} />
              </div>
            </section>
          )}

          {caseData.taskType === 'overdue_payment' && (
            <section className="bg-white/50 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" /> ข้อมูลคดีค่าไฟฟ้าค้างชำระ
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <Field label="ชื่อนามสกุล" value={caseData.op_customerName} />

                {caseData.op_details && Array.isArray(caseData.op_details) && caseData.op_details.length > 0 ? (
                  <div className="mt-2 space-y-3">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">รายการ CA ทั้งหมด</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {caseData.op_details.map((detail: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/50">
                          <p className="text-[10px] font-bold text-emerald-600 mb-2">CA: {detail.op_ReferenceNumber}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-slate-500 text-[10px]">ตั้งแต่ - ถึง</p>
                              <p className="font-medium text-slate-700">{detail.op_OverdueBillStart} - {detail.op_overdueBillEnd}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-slate-500 text-[10px]">จำนวนเงิน</p>
                              <p className="font-bold text-emerald-700">{Number(detail.op_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="เลขที่อ้างอิง (CA)" value={caseData.op_ReferenceNumber} />
                    <Field label="บิลที่ค้าง (ตั้งแต่)" value={caseData.op_OverdueBillStart} />
                    <Field label="บิลที่ค้าง (ถึง)" value={caseData.op_overdueBillEnd} />
                    <Field label="จำนวนเงิน (บาท)" value={caseData.op_amount ? Number(caseData.op_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : undefined} />
                  </div>
                )}
              </div>
            </section>
          )}

          {caseData.taskType === 'fine' && (
            <section className="bg-white/50 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Gavel className="w-4 h-4 text-amber-400" /> ข้อมูลคดีค่าละเมิดการใช้ไฟฟ้า
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <Field label="ชื่อนามสกุล" value={caseData.fn_customerName} />

                {caseData.fn_details && Array.isArray(caseData.fn_details) && caseData.fn_details.length > 0 ? (
                  <div className="mt-2 space-y-3">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">รายการ CA/ค่าปรับ ทั้งหมด</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {caseData.fn_details.map((detail: any, idx: number) => {
                        return (
                          <div key={idx} className="p-3 rounded-xl bg-amber-50/50 border border-amber-100/50">
                            <p className="text-[10px] font-bold text-amber-600 mb-2">CA: {detail.fn_ReferenceNumber}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-slate-500 text-[10px]">ช่วงบิล</p>
                                <p className="font-medium text-slate-700">{detail.fn_OverdueBillStart} - {detail.fn_OverdueBillEnd}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-slate-500 text-[10px]">ค่าเบี้ยปรับ</p>
                                <p className="font-bold text-amber-700">{Number(detail.fn_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="หมายเลขอ้างอิง (CA)" value={caseData.fn_ReferenceNumber} />
                    <Field label="บิลเดือนเป็นช่วง (ตั้งแต่)" value={caseData.fn_OverdueBillStart} />
                    <Field label="บิลเดือนเป็นช่วง (ถึง)" value={caseData.fn_OverdueBillEnd} />
                    <Field label="ค่าเบี้ยปรับละเมิด (บาท)" value={caseData.fn_amount ? Number(caseData.fn_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : undefined} />
                  </div>
                )}

                {parseFees(caseData.fn_additionalFees).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">ค่าอื่นๆ</p>
                    <div className="space-y-1">
                      {parseFees(caseData.fn_additionalFees).map((fee: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-slate-600">{fee.name}</span>
                          <span className="font-medium text-slate-800">{Number(fee.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">รวมทั้งสิ้น</span>
                  <span className="text-lg font-bold text-amber-600">
                    {(() => {
                      const baseFineSum = (caseData.fn_details || []).reduce((sum: number, d: any) => sum + (parseFloat(d.fn_amount) || 0), 0);
                      const baseFineSingle = parseFloat(caseData.fn_amount || '0') || 0;
                      const additionalSum = (parseFees(caseData.fn_additionalFees) || []).reduce((sum: number, fee: any) => sum + (parseFloat(fee.amount) || 0), 0);
                      const effectiveBase = (caseData.fn_details && caseData.fn_details.length > 0) ? baseFineSum : baseFineSingle;
                      return (effectiveBase + additionalSum).toLocaleString('th-TH', { minimumFractionDigits: 2 });
                    })()} บาท
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* gov_debt detail */}
          {caseData.taskType === 'gov_debt' && (
            <section className="bg-white/50 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-violet-400" /> ข้อมูลคดีลูกหนี้ราชการ
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <Field label="ชื่อนามสกุล" value={caseData.fngov_customerName} />
                {Array.isArray(caseData.fngov_details) && caseData.fngov_details.length > 0 && (
                  <div className="mt-2 space-y-3">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">รายการ CA ทั้งหมด</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {caseData.fngov_details.map((d: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-violet-50/50 border border-violet-100/50">
                          <p className="text-[10px] font-bold text-violet-600 mb-1">CA: {d.fngov_ReferenceNumber} | สาขา: {d.fngov_agencyBranch}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><p className="text-slate-500 text-[10px]">ตั้งแต่ - ถึง</p><p className="font-medium text-slate-700">{d.fngov_OverdueBillStart} - {d.fngov_overdueBillEnd}</p></div>
                            <div className="text-right"><p className="text-slate-500 text-[10px]">จำนวนเงิน</p><p className="font-bold text-violet-700">{Number(d.fngov_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.</p></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {parseFees(caseData.fngov_additionalFees).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">ค่าอื่นๆ</p>
                    {parseFees(caseData.fngov_additionalFees).map((fee: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm"><span className="text-slate-600">{fee.name}</span><span className="font-medium">{Number(fee.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.</span></div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* fine_btc detail */}
          {caseData.taskType === 'fine_btc' && (
            <section className="bg-white/50 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Hash className="w-4 h-4 text-orange-400" /> ข้อมูลคดีค่าละเมิดบิทคอยน์
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <Field label="ชื่อนามสกุล" value={caseData.fnbtc_customerName} />
                {Array.isArray(caseData.fnbtc_details) && caseData.fnbtc_details.length > 0 && (
                  <div className="mt-2 space-y-3">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">รายการ CA ทั้งหมด</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {caseData.fnbtc_details.map((d: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-orange-50/50 border border-orange-100/50">
                          <p className="text-[10px] font-bold text-orange-600 mb-1">CA: {d.fnbtc_ReferenceNumber}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><p className="text-slate-500 text-[10px]">ตั้งแต่ - ถึง</p><p className="font-medium text-slate-700">{d.fnbtc_OverdueBillStart} - {d.fnbtc_overdueBillEnd}</p></div>
                            <div className="text-right"><p className="text-slate-500 text-[10px]">จำนวนเงิน</p><p className="font-bold text-orange-700">{Number(d.fnbtc_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.</p></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {parseFees(caseData.fnbtc_additionalFees).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">ค่าอื่นๆ</p>
                    {parseFees(caseData.fnbtc_additionalFees).map((fee: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm"><span className="text-slate-600">{fee.name}</span><span className="font-medium">{Number(fee.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.</span></div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* fine_cable detail */}
          {caseData.taskType === 'fine_cable' && (
            <section className="bg-white/50 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/40 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-cyan-400" /> ข้อมูลคดีค่าละเมิดสายสื่อสาร
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="ชื่อนามสกุล" value={caseData.fncable_customerName} />
                <Field label="จำนวนเงิน (บาท)" value={caseData.fncable_amount ? Number(caseData.fncable_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : undefined} />
                <Field label="วันที่ตรวจพบ" value={caseData.fncable_detectedDate} />
              </div>
            </section>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-white/80 backdrop-blur-md border-t border-slate-200/50 flex flex-col-reverse sm:flex-row gap-3 sm:gap-0 sm:justify-between sm:items-center shrink-0 safe-pb">
          {onUnarchive && (
            <button
              onClick={handleUnarchive}
              disabled={isUnarchiving}
              className="inline-flex items-center justify-center gap-2 px-4 py-3.5 sm:py-2.5 rounded-2xl text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              <Archive className="w-4 h-4" />
              {isUnarchiving ? 'กำลังดำเนินการ...' : 'ยกเลิกการจัดเก็บ'}
            </button>
          )}
          <button onClick={onClose} className="px-6 py-3.5 sm:py-2.5 rounded-2xl font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors shadow-sm w-full sm:w-auto sm:ml-auto">
            ปิดหน้าต่าง
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Archived View Component
const ArchivedView = ({ onUpdate }: { onUpdate: () => void }) => {
  const [archivedCases, setArchivedCases] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    setLoading(true);
    fetch('/api/cases/archived')
      .then(res => res.json())
      .then(data => { setArchivedCases(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = archivedCases.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.docNumber || '').toLowerCase().includes(q) ||
      (c.lawyerName || '').toLowerCase().includes(q) ||
      (c.sourceName || '').toLowerCase().includes(q) ||
      (c.cc_driverName || '').toLowerCase().includes(q) ||
      (c.op_customerName || '').toLowerCase().includes(q) ||
      (c.fn_customerName || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getCaseDetails = (c: any) => {
    if (c.taskType === 'car_crash') return { name: c.cc_driverName || '-', ref: c.cc_ReferenceNumber || '-', type: 'รถชนเสา' };
    if (c.taskType === 'overdue_payment') return { name: c.op_customerName || '-', ref: c.op_ReferenceNumber || '-', type: 'ค่าไฟฟ้าค้างชำระ' };
    if (c.taskType === 'gov_debt') return { name: c.fngov_customerName || '-', ref: '-', type: 'ลูกหนี้ราชการ' };
    if (c.taskType === 'fine_btc') return { name: c.fnbtc_customerName || '-', ref: '-', type: 'ค่าละเมิดบิทคอยน์' };
    if (c.taskType === 'fine_cable') return { name: c.fncable_customerName || '-', ref: '-', type: 'ค่าละเมิดสายสื่อสาร' };
    return { name: c.fn_customerName || '-', ref: c.fn_ReferenceNumber || '-', type: c.fn_fineTypeName || 'ค่าปรับ' };
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">เอกสารคดีที่จัดเก็บแล้ว</h2>
            <p className="text-slate-500 mt-1">รายการคดีที่ถูก Archive ทั้งหมด ({filtered.length} รายการ)</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่หนังสือ, ทนาย, ต้นทาง..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-11 pr-4 py-3 bg-white/60 backdrop-blur-md border border-white/40 shadow-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto pb-2">
            <table className="w-full min-w-[800px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/50 bg-slate-50/50">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">เอกสาร</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">ประเภท</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">รายละเอียด</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">สถานะงาน</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">ทนาย</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">isFinish</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-slate-400">
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                        <span>กำลังโหลดข้อมูล...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <FolderArchive className="w-12 h-12 text-slate-300" />
                        <span>ไม่พบข้อมูลเอกสารที่จัดเก็บแล้ว</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((c) => {
                    const details = getCaseDetails(c);
                    return (
                      <tr key={c.id} onClick={() => setSelectedCase(c)} className="border-b border-slate-100 last:border-0 hover:bg-white/80 cursor-pointer transition-colors group">
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-800 font-medium">{c.docNumber || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Archive className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500">{c.sourceName || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {c.taskType === 'car_crash' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 max-w-full whitespace-normal break-words leading-tight">
                              <Car className="w-4 h-4 shrink-0" /> <span className="min-w-0">รถชนเสา</span>
                            </span>
                          ) : c.taskType === 'fine' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100 max-w-full whitespace-normal break-words leading-tight">
                              <Gavel className="w-4 h-4 shrink-0" /> <span className="min-w-0">{details.type}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 max-w-full whitespace-normal break-words leading-tight">
                              <CreditCard className="w-4 h-4 shrink-0" /> <span className="min-w-0">ค่าไฟฟ้าค้างชำระ</span>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-800 font-medium">{details.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500">{details.ref}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 mb-1">
                            <ClipboardList className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border max-w-full whitespace-normal break-words leading-tight
                            ${c.taskStateName === 'เสร็จสิ้น' ? 'bg-green-50 text-green-700 border-green-100' :
                                c.taskStateName === 'กำลังดำเนินการ' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                  'bg-slate-100 text-slate-700 border-slate-200'}`}
                            >
                              {c.taskStateName || '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileCheck className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600 max-w-full whitespace-normal break-words leading-tight">
                              {c.docStateName || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{c.lawyerName || '-'}</td>
                        <td className="px-6 py-4">
                          {c.isFinish ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 max-w-full whitespace-normal break-words leading-tight">
                              <CheckCircle2 className="w-3.5 h-3.5" /> เสร็จสิ้นแล้ว
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 max-w-full whitespace-normal break-words leading-tight">
                              <XCircle className="w-3.5 h-3.5" /> ยังไม่เสร็จ
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                แสดง {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} จาก {filtered.length} รายการ
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-slate-700 px-2">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedCase && (
          <CaseDetailModal
            caseData={selectedCase}
            onClose={() => setSelectedCase(null)}
            onUnarchive={() => {
              setSelectedCase(null);
              setLoading(true);
              fetch('/api/cases/archived')
                .then(r => r.json())
                .then(data => { setArchivedCases(Array.isArray(data) ? data : []); setLoading(false); })
                .catch(() => setLoading(false));
              onUpdate();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// List View Component
const ListView = ({ cases, dropdowns, onUpdate }: { cases: any[], dropdowns: Dropdowns, onUpdate: () => void }) => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const itemsPerPage = 8;

  const isArchivedValue = (value: any) => {
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    }
    return Boolean(value);
  };

  const activeCases = cases.filter(c => !isArchivedValue(c.isArchived));

  const getCaseDetails = (c: any) => {
    let name = '';
    let referenceNumber = '';
    let type = '';

    if (c.taskType === 'car_crash') {
      name = c.cc_driverName;
      referenceNumber = c.cc_ReferenceNumber;
      type = 'รถชนเสา';
    } else if (c.taskType === 'overdue_payment') {
      name = c.op_customerName;
      referenceNumber = c.op_ReferenceNumber;
      type = 'ค่าไฟฟ้าค้างชำระ';
    } else if (c.taskType === 'fine') {
      name = c.fn_customerName;
      referenceNumber = c.fn_ReferenceNumber;
      type = c.fn_fineTypeName || 'ค่าละเมิดการใช้ไฟฟ้า';
    } else if (c.taskType === 'gov_debt') {
      name = c.fngov_customerName;
      referenceNumber = '';
      type = 'ลูกหนี้ราชการ';
    } else if (c.taskType === 'fine_btc') {
      name = c.fnbtc_customerName;
      referenceNumber = '';
      type = 'ค่าละเมิดบิทคอยน์';
    } else if (c.taskType === 'fine_cable') {
      name = c.fncable_customerName;
      referenceNumber = '';
      type = 'ค่าละเมิดสายสื่อสาร';
    }
    return { name, referenceNumber, type };
  };

  const filteredCases = activeCases.filter(c => {
    const details = getCaseDetails(c);
    const searchLower = search.toLowerCase();
    return (
      (c.docNumber || "").toLowerCase().includes(searchLower) ||
      (c.lawyerName || "").toLowerCase().includes(searchLower) ||
      (c.sourceName || "").toLowerCase().includes(searchLower) ||
      (details.name || "").toLowerCase().includes(searchLower) ||
      (details.referenceNumber || "").toLowerCase().includes(searchLower) ||
      (details.type || "").toLowerCase().includes(searchLower) ||
      (c.docStateName || "").toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = filteredCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">รายการคดี</h2>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่หนังสือ, ทนาย, ต้นทาง..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white/60 backdrop-blur-md border border-white/40 shadow-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto pb-2">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/50 bg-slate-50/50">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">เอกสาร</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">ประเภท</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">รายละเอียด</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">สถานะงาน</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">ทนาย</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">ไม่พบข้อมูลคดี</td>
                </tr>
              ) : (
                paginatedCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className="border-b border-slate-100 last:border-0 hover:bg-white/80 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-800 font-medium group-hover:text-indigo-600 transition-colors">{c.docNumber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-500">{c.sourceName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {c.taskType === 'car_crash' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 max-w-full whitespace-normal break-words leading-tight">
                          <Car className="w-4 h-4 shrink-0" /> <span className="min-w-0">รถชนเสา</span>
                        </span>
                      ) : c.taskType === 'fine' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100 max-w-full whitespace-normal break-words leading-tight">
                          <Gavel className="w-4 h-4 shrink-0" /> <span className="min-w-0">{getCaseDetails(c).type}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 max-w-full whitespace-normal break-words leading-tight">
                          <CreditCard className="w-4 h-4 shrink-0" /> <span className="min-w-0">ค่าไฟฟ้าค้างชำระ</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-800 font-medium">{getCaseDetails(c).name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-500">{getCaseDetails(c).referenceNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardList className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border max-w-full whitespace-normal break-words leading-tight
                          ${c.taskStateName === 'เสร็จสิ้น' ? 'bg-green-50 text-green-700 border-green-100' :
                            c.taskStateName === 'กำลังดำเนินการ' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              'bg-slate-100 text-slate-700 border-slate-200'}`}
                        >
                          {c.taskStateName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600 max-w-full whitespace-normal break-words leading-tight">
                          {c.docStateName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.lawyerName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between px-4 sm:px-6 py-4 border-t border-slate-200/50 bg-white/40">
            <span className="text-sm text-slate-500 hidden sm:block">
              แสดง {(currentPage - 1) * itemsPerPage + 1} ถึง {Math.min(currentPage * itemsPerPage, filteredCases.length)} จาก {filteredCases.length} รายการ
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl hover:bg-white/80 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex items-center gap-1">
                {(() => {
                  const pages: (number | '...')[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 4) pages.push('...');
                    const start = Math.max(2, currentPage - 2);
                    const end = Math.min(totalPages - 1, currentPage + 2);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (currentPage < totalPages - 3) pages.push('...');
                    pages.push(totalPages);
                  }
                  return pages.map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-slate-400 text-sm select-none">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${currentPage === p
                          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                          : 'text-slate-600 hover:bg-white/80'
                          }`}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl hover:bg-white/80 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedCase && (
          <EditModal
            caseData={selectedCase}
            dropdowns={dropdowns}
            onClose={() => setSelectedCase(null)}
            onSaveSuccess={() => {
              setSelectedCase(null);
              onUpdate();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Create Form Component
const CreateForm = ({ dropdowns, onSuccess }: { dropdowns: Dropdowns, onSuccess: () => void }) => {
  const [formData, setFormData] = useState({
    taskType: 'car_crash',
    source: '',
    receiveDate: '',
    docNumber: '',
    docState: '',
    returnDocNumber: '',
    approvalDocNumber: '',
    taskState: '',
    lawyer: '',
    cc_licensePlate: '',
    cc_driverName: '',
    cc_ReferenceNumber: '',
    cc_damageAmount: '',
    op_ReferenceNumber: '',
    op_customerName: '',
    op_details: [],
    fn_customerName: '',
    fn_details: [],
    fn_additionalFees: [],
    fngov_customerName: '',
    fngov_details: [],
    fngov_additionalFees: [],
    fnbtc_customerName: '',
    fnbtc_details: [],
    fnbtc_additionalFees: [],
    fncable_customerName: '',
    fncable_amount: '',
    fncable_detectedDate: '',
    notes: '',
  });
  const [files, setFiles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'keptDocuments' || key === 'courtDocument' || key === 'courtDocuments') return;
        if (Array.isArray(value)) {
          data.append(key, JSON.stringify(value));
        } else {
          data.append(key, value as string);
        }
      });

      // Calculate and add total fine amount (base + additional fees)
      if (formData.taskType === 'fine') {
        const baseFineSum = (formData.fn_details || []).reduce((sum: number, d: any) => sum + (parseFloat(d.fn_amount) || 0), 0);
        const additionalSum = (formData.fn_additionalFees || []).reduce((sum: number, fee: any) => sum + (parseFloat(fee.amount) || 0), 0);
        const totalAmount = baseFineSum + additionalSum;
        data.append('fn_totalAmount', String(totalAmount));
      }

      if (files && files.length > 0) {
        files.forEach((f: any) => {
          if (f.file) {
            data.append("courtDocuments", f.file);
            data.append("documentDescriptions", f.description || f.file.name);
          }
        });
      }

      const response = await fetch('/api/cases', {
        method: 'POST',
        body: data,
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({
          taskType: 'car_crash', source: '', receiveDate: '', docNumber: '', docState: '', returnDocNumber: '', approvalDocNumber: '', taskState: '', lawyer: '', cc_licensePlate: '', cc_driverName: '', cc_ReferenceNumber: '', cc_damageAmount: '', op_ReferenceNumber: '', op_customerName: '', op_OverdueBillStart: '', op_overdueBillEnd: '', op_amount: '', fn_fineType: '', fn_fineTypeName: '', fn_ReferenceNumber: '', fn_OverdueBillStart: '', fn_OverdueBillEnd: '', fn_amount: '', fn_additionalFees: [], fn_details: [], fngov_customerName: '', fngov_details: [], fngov_additionalFees: [], fnbtc_customerName: '', fnbtc_details: [], fnbtc_additionalFees: [], fncable_customerName: '', fncable_amount: '', fncable_detectedDate: '', notes: '',
        });
        setFiles([]);
        onSuccess();
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">สร้างรายการใหม่</h2>
        <p className="text-sm sm:text-base text-slate-500 mt-2">กรอกข้อมูลรายละเอียดคดีเพื่อบันทึกลงในระบบ</p>
      </div>

      <form onSubmit={handleSubmit}>
        <CaseFormFields
          formData={formData}
          setFormData={setFormData}
          files={files}
          setFiles={setFiles}
          dropdowns={dropdowns}
          isEditMode={false}
        />

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-xl shadow-blue-500/30 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                กำลังบันทึก...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> บันทึกข้อมูล
              </span>
            )}
          </button>
        </div>
      </form>

      {/* Success Modal */}
      <AnimatePresence>
        {submitStatus === 'success' && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white/95 backdrop-blur-3xl rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center border border-white/40"
            >
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">บันทึกสำเร็จ</h3>
              <p className="text-slate-500 text-sm mb-6">บันทึกข้อมูลคดีเรียบร้อยแล้ว</p>
              <button
                onClick={() => setSubmitStatus('idle')}
                className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-medium hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/30"
              >
                ตกลง
              </button>
            </motion.div>
          </div>
        )}
        {submitStatus === 'error' && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white/95 backdrop-blur-3xl rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center border border-white/40"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">เกิดข้อผิดพลาด</h3>
              <p className="text-slate-500 text-sm mb-6">ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง</p>
              <button
                onClick={() => setSubmitStatus('idle')}
                className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-2xl font-medium hover:from-red-600 hover:to-rose-600 transition-all shadow-lg shadow-red-500/30"
              >
                ปิด
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Main App Component
function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'pending' | 'approved' | 'error'>('loading');
  const [authError, setAuthError] = useState<string>('');
  const [currentView, setCurrentView] = useState<'stats' | 'list' | 'kanban' | 'create' | 'archived'>('stats');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [cases, setCases] = useState<any[]>([]);
  const [dropdowns, setDropdowns] = useState<Dropdowns>({
    source: [], docState: [], taskState: [], lawyer: [], fineType: [], uploadFileTypes: []
  });

  useEffect(() => {
    const liffId = (import.meta as any).env?.VITE_LIFF_ID || (window as any).__LIFF_ID__ || '2009414446-4CvOZQML';
    initLiff(liffId);
  }, []);

  const initLiff = async (liffId: string) => {
    try {
      console.log('Initializing LIFF with ID:', liffId);

      // Dev bypass: ถ้า VITE_DEV_MODE=1 และมี ?bypass=1 ใน URL ให้ข้ามการ login
      const urlParams = new URLSearchParams(window.location.search);
      const isDevMode = (import.meta as any).env?.VITE_DEV_MODE === '1';
      if (isDevMode && urlParams.get('bypass') === '1') {
        console.log('DEV BYPASS MODE - skipping LIFF auth');
        const mockUser: AuthUser = { userId: 'dev_user', displayName: 'Dev User', pictureUrl: '', permission: 1 };
        setAuthUser(mockUser);
        setAuthStatus('approved');
        return;
      }

      await liff.init({ liffId });
      console.log('LIFF initialized, isLoggedIn:', liff.isLoggedIn());

      if (!liff.isLoggedIn()) {
        console.log('Not logged in, redirecting to LINE login...');
        liff.login();
        return;
      }

      console.log('Getting profile...');
      const profile = await liff.getProfile();
      console.log('Profile received:', profile);

      console.log('Sending auth request to backend...');
      const res = await fetch('/api/auth/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          statusMessage: profile.statusMessage || '',
        }),
      });

      if (!res.ok) {
        console.error('Backend auth failed:', res.status, await res.text());
        throw new Error('Backend auth failed');
      }

      const data = await res.json();
      console.log('Backend auth response:', data);

      const user: AuthUser = {
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        permission: data.permission ?? 0,
      };
      setAuthUser(user);
      setAuthStatus(data.permission === 1 ? 'approved' : 'pending');
      console.log('Auth status set to:', data.permission === 1 ? 'approved' : 'pending');
    } catch (err: any) {
      console.error('LIFF init error:', err);
      console.error('Error details:', {
        message: err?.message,
        stack: err?.stack,
        name: err?.name
      });
      setAuthError(err?.message || String(err));
      setAuthStatus('error');
    }
  };

  const fetchData = async () => {
    try {
      const [source, docState, taskState, lawyer, fineType, uploadFileTypes, casesData] = await Promise.all([
        fetch('/api/sheets/source').then(res => res.json()),
        fetch('/api/sheets/doc_state').then(res => res.json()),
        fetch('/api/sheets/task_state').then(res => res.json()),
        fetch('/api/sheets/lawyer').then(res => res.json()),
        fetch('/api/sheets/fine_type').then(res => res.json()),
        fetch('/api/sheets/upload_file_types').then(res => res.json()),
        fetch('/api/cases').then(res => res.json())
      ]);
      // Normalize responses into DropdownOption[] (id,label)
      const toDropdown = (data: any, customKey?: string): DropdownOption[] => {
        if (!data) return [];
        // If we want a specific column, use 'rows' as it contains the raw data with all columns
        if (customKey && data.rows && Array.isArray(data.rows)) return toDropdown(data.rows, customKey);

        // If wrapper object with options/normalized/rows
        if (data.options && Array.isArray(data.options)) return toDropdown(data.options, customKey);
        if (data.normalized && Array.isArray(data.normalized)) return toDropdown(data.normalized, customKey);
        if (data.rows && Array.isArray(data.rows)) return toDropdown(data.rows, customKey);
        if (Array.isArray(data)) {
          if (data.length === 0) return [];
          const first = data[0];
          if (first && typeof first === 'object') {
            if (customKey && customKey in first) {
              return data.map((o: any, i: number) => ({
                id: customKey === 'source' ? String(i + 1) : String(o['id'] || o[customKey] || (i + 1)),
                label: String(o[customKey] ?? '')
              }));
            }
            if ('id' in first && 'label' in first) return data;
            const keys = Object.keys(first);
            if (keys.length === 1) return data.map((o: any, i: number) => ({ id: String(i + 1), label: String(o[keys[0]] ?? '') }));
            if (keys.length >= 2) return data.map((o: any) => ({ id: String(o[keys[0]] ?? ''), label: String(o[keys[1]] ?? '') }));
          }
          // primitives
          return data.map((v: any, i: number) => ({ id: String(i + 1), label: String(v) }));
        }
        return [];
      };

      setDropdowns({ source: toDropdown(source, 'source'), docState: toDropdown(docState), taskState: toDropdown(taskState), lawyer: toDropdown(lawyer), fineType: toDropdown(fineType), uploadFileTypes: toDropdown(uploadFileTypes) });
      setCases(casesData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Early returns for auth states (after all hooks)
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'error') {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-6">
        <div className="bg-white/80 rounded-3xl p-8 text-center max-w-sm shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-slate-500 text-sm mb-3">ไม่สามารถเชื่อมต่อกับ LINE ได้ กรุณาเปิดผ่าน LINE แอพ</p>
          {authError && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-left">
              <p className="text-xs text-red-600 font-mono break-all">{authError}</p>
            </div>
          )}
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-indigo-500 text-white rounded-2xl font-medium hover:bg-indigo-600 transition-colors">
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  if (authStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl border border-white/40">
          {authUser?.pictureUrl && (
            <img src={authUser.pictureUrl} alt="profile" className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white shadow-lg" />
          )}
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">รอตรวจสอบสิทธิ์</h2>
          <p className="text-slate-500 text-sm mb-2">สวัสดี <span className="font-semibold text-slate-700">{authUser?.displayName}</span></p>
          <p className="text-slate-400 text-sm mb-6">บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ กรุณารอสักครู่</p>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left mb-6">
            <p className="text-xs text-amber-700 font-medium">ข้อมูลที่ส่งให้ผู้ดูแล</p>
            <p className="text-xs text-amber-600 mt-1">User ID: {authUser?.userId}</p>
          </div>
          <button onClick={() => window.location.reload()} className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-medium hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg shadow-indigo-500/30">
            ตรวจสอบสถานะอีกครั้ง
          </button>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'stats', label: 'สถิติภาพรวม', icon: BarChart2 },
    { id: 'list', label: 'รายการคดี', icon: LayoutDashboard },
    { id: 'create', label: 'สร้างรายการใหม่', icon: PlusCircle },
    { id: 'archived', label: 'เอกสารคดีที่จัดเก็บแล้ว', icon: FolderArchive },
  ];

  return (
    <AuthContext.Provider value={authUser}>
      <div className="min-h-screen bg-[#F2F2F7] flex font-sans selection:bg-blue-200" style={{ fontFamily: "'Sarabun', sans-serif" }}>
        {/* Sidebar (Desktop) */}
        <aside
          className={`hidden md:flex flex-col bg-white/80 backdrop-blur-3xl border-r border-white/40 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-all duration-300 ease-in-out fixed top-0 left-0 h-screen ${isSidebarCollapsed ? 'w-24' : 'w-72'
            }`}
        >
          <div className={`p-8 flex items-center ${isSidebarCollapsed ? 'justify-center px-4' : 'justify-between'}`}>
            <div className="flex items-center gap-3">

              {authUser.userId == 'Ufda7e6c344e079c6382d0a29388e2dc1' ? (
                <img
                  src="https://drive.google.com/thumbnail?id=1nK4ndNauE6H5uGcmIMByXPM17JvFZmYj&sz=w1000"
                  alt="รูปภาพ"
                // อย่าลืมใส่ขนาดให้รูปด้วยนะ เดี๋ยวรูปเบิ้ม!
                />
              ) : (
                // ต้องมี Fragment หุ้ม เพราะมี 2 Elements อยู่ข้างกัน
                <>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                    <FileText className="w-6 h-6 text-white" />
                  </div>

                  {!isSidebarCollapsed && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <h1 className="text-xl font-bold text-slate-800 tracking-tight whitespace-nowrap">ระบบจัดการคดี</h1>
                      <p className="text-xs text-slate-500 mt-0.5">Legal Case Management</p>
                    </motion.div>
                  )}
                </>
              )}


            </div>
          </div>

          <nav className="flex-1 px-4 space-y-2 mt-4">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id as any)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all group ${currentView === item.id
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100/80'
                  }`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${currentView === item.id ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {!isSidebarCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-200/50">
            {/* User profile + collapse + logout */}
            {!isSidebarCollapsed && authUser ? (
              <div className="flex items-center gap-2 px-2 py-2">
                {authUser.pictureUrl
                  ? <img src={authUser.pictureUrl} alt="profile" className="w-8 h-8 rounded-full shrink-0" />
                  : <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-indigo-500" /></div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{authUser.displayName}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    <p className="text-xs text-emerald-600">อนุมัติแล้ว</p>
                  </div>
                </div>
                <button
                  onClick={() => { try { liff.logout(); } catch { } window.location.reload(); }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : null}
            <div className="flex justify-center mt-2">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>
              {isSidebarCollapsed && (
                <button
                  onClick={() => { try { liff.logout(); } catch { } window.location.reload(); }}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 z-50 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-800">ระบบจัดการคดี</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden fixed inset-0 z-40 bg-white/95 backdrop-blur-3xl pt-20 px-4"
            >
              <nav className="space-y-2">
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setCurrentView(item.id as any); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-medium transition-all ${currentView === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
                      }`}
                  >
                    <item.icon className="w-5 h-5" /> {item.label}
                  </button>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className={`flex-1 overflow-y-auto pt-16 md:pt-0 relative transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-24' : 'md:ml-72'}`}>
          {/* Background decorative elements */}
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-br from-blue-100/40 via-purple-100/40 to-emerald-100/40 pointer-events-none" />
          <div className="absolute top-20 right-20 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 p-4 md:p-8 lg:p-12 mx-auto">



            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {currentView === 'stats' && <StatsDashboard cases={cases} />}
                {currentView === 'list' && <ListView cases={cases} dropdowns={dropdowns} onUpdate={fetchData} />}
                {currentView === 'create' && <CreateForm dropdowns={dropdowns} onSuccess={fetchData} />}
                {currentView === 'archived' && <ArchivedView onUpdate={fetchData} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </AuthContext.Provider>
  );
}

export default App;
