import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  FileText, Car, CreditCard, Upload, CheckCircle2, AlertCircle, Search, ChevronDown, 
  LayoutDashboard, PlusCircle, Menu, X, ChevronLeft, ChevronRight, Edit2, 
  Archive, Trello, BarChart2, PanelLeftClose, PanelLeftOpen, GripVertical
} from 'lucide-react';

// --- Types ---
type DropdownOption = { id: string; label: string };
type Dropdowns = {
  source: DropdownOption[];
  docState: DropdownOption[];
  taskState: DropdownOption[];
  lawyer: DropdownOption[];
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

// Reusable Form Fields Component
const CaseFormFields = ({ formData, setFormData, file, setFile, dropdowns, isEditMode = false }: any) => {
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
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">ประเภทงาน <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isEditMode}
                onClick={() => setFormData({ ...formData, taskType: 'car_crash' })}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                  formData.taskType === 'car_crash' 
                    ? 'border-blue-500 bg-blue-50/50 text-blue-700' 
                    : 'border-slate-100 bg-white/50 text-slate-500 hover:border-slate-200'
                } ${isEditMode ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <Car className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">รถยนต์ชนเสา</span>
              </button>
              <button
                type="button"
                disabled={isEditMode}
                onClick={() => setFormData({ ...formData, taskType: 'overdue_payment' })}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                  formData.taskType === 'overdue_payment' 
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700' 
                    : 'border-slate-100 bg-white/50 text-slate-500 hover:border-slate-200'
                } ${isEditMode ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <CreditCard className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">ค้างชำระ</span>
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
            <label className="text-sm font-medium text-slate-700 ml-1">เอกสารจากศาล (อัปโหลดขึ้น Google Drive)</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-2xl bg-white/30 hover:bg-white/50 transition-colors relative">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-slate-400" />
                <div className="flex text-sm text-slate-600 justify-center">
                  <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                    <span>อัปโหลดไฟล์</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>
                  <p className="pl-1">หรือลากวางที่นี่</p>
                </div>
                <p className="text-xs text-slate-500">PDF, PNG, JPG ไม่เกิน 10MB</p>
                {file && <p className="text-sm font-medium text-emerald-600 mt-2 bg-emerald-50 py-1 px-3 rounded-full inline-block">{file.name}</p>}
              </div>
            </div>
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
                <input type="text" name="licensePlate" required value={formData.licensePlate} onChange={handleChange} placeholder="เช่น กท 1234" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">ชื่อ-นามสกุล คนขับ หรือ ประกัน <span className="text-red-500">*</span></label>
                <input type="text" name="driverName" required value={formData.driverName} onChange={handleChange} placeholder="ระบุชื่อ" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700 ml-1">ยอดเสียหาย (บาท) <span className="text-red-500">*</span></label>
                <input type="number" name="damageAmount" required value={formData.damageAmount} onChange={handleChange} placeholder="0.00" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400" />
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
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-500" /> ข้อมูลคดีค้างชำระ
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700 ml-1">เลขที่อ้างอิง <span className="text-red-500">*</span></label>
                <input type="text" name="referenceNumber" required value={formData.referenceNumber} onChange={handleChange} placeholder="ระบุเลขที่อ้างอิง" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder-slate-400" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">บิลที่ค้าง (ตั้งแต่) <span className="text-red-500">*</span></label>
                <input type="date" name="overdueBillStart" required value={formData.overdueBillStart} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 ml-1">บิลที่ค้าง (ถึง) <span className="text-red-500">*</span></label>
                <input type="date" name="overdueBillEnd" required value={formData.overdueBillEnd} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700 ml-1">จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                <input type="number" name="amount" required value={formData.amount} onChange={handleChange} placeholder="0.00" className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder-slate-400" />
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
  const [formData, setFormData] = useState({
    taskType: caseData.taskType || "car_crash",
    source: caseData.source || "",
    receiveDate: caseData.receiveDate || "",
    docNumber: caseData.docNumber || "",
    docState: caseData.docState || "",
    returnDocNumber: caseData.returnDocNumber || "",
    taskState: caseData.taskState || "",
    lawyer: caseData.lawyer || "",
    licensePlate: caseData.licensePlate || "",
    driverName: caseData.driverName || "",
    damageAmount: caseData.damageAmount || "",
    referenceNumber: caseData.referenceNumber || "",
    overdueBillStart: caseData.overdueBillStart || "",
    overdueBillEnd: caseData.overdueBillEnd || "",
    amount: caseData.amount || "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value as string);
      });
      if (file) data.append("courtDocument", file);

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

  const handleArchive = async () => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการจัดเก็บ (Archive) คดีนี้?")) return;
    setIsArchiving(true);
    try {
      const response = await fetch(`/api/cases/${caseData.id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        onSaveSuccess();
      }
    } catch (error) {
      console.error("Error archiving case:", error);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#F2F2F7]/95 backdrop-blur-3xl rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/40"
      >
        <div className="flex items-center justify-between p-6 bg-white/50 border-b border-slate-200/50">
          <h2 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
            <Edit2 className="w-6 h-6 text-indigo-500" />
            แก้ไขข้อมูลคดี {caseData.docNumber}
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleArchive} 
              disabled={isArchiving}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors text-sm font-medium"
            >
              <Archive className="w-4 h-4" /> {isArchiving ? "กำลังจัดเก็บ..." : "จัดเก็บ (Archive)"}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors">
              <X className="w-6 h-6 text-slate-500" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <form id="edit-form" onSubmit={handleSubmit}>
            <CaseFormFields 
              formData={formData} 
              setFormData={setFormData} 
              file={file} 
              setFile={setFile} 
              dropdowns={dropdowns} 
              isEditMode={true}
            />
          </form>
        </div>

        <div className="p-6 bg-white/50 border-t border-slate-200/50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-2xl font-medium text-slate-600 hover:bg-slate-200/50 transition-colors">
            ยกเลิก
          </button>
          <button type="submit" form="edit-form" disabled={isSubmitting} className="px-6 py-3 rounded-2xl font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-70">
            {isSubmitting ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Stats Dashboard Component
const StatsDashboard = ({ cases }: { cases: any[] }) => {
  const activeCases = cases.filter(c => !c.isArchived);
  
  const typeData = [
    { name: 'รถยนต์ชนเสา', value: activeCases.filter(c => c.taskType === 'car_crash').length },
    { name: 'ค้างชำระ', value: activeCases.filter(c => c.taskType === 'overdue_payment').length }
  ];

  const statusData = [
    { name: 'รับเรื่อง', value: activeCases.filter(c => c.taskStateName === 'รับเรื่อง').length },
    { name: 'กำลังดำเนินการ', value: activeCases.filter(c => c.taskStateName === 'กำลังดำเนินการ').length },
    { name: 'เสร็จสิ้น', value: activeCases.filter(c => c.taskStateName === 'เสร็จสิ้น').length }
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">สถิติภาพรวม</h2>
        <p className="text-slate-500 mt-2">ข้อมูลสรุปคดีที่กำลังดำเนินการในระบบ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl p-6 flex flex-col items-center justify-center">
          <div className="text-slate-500 font-medium mb-2">คดีทั้งหมด (Active)</div>
          <div className="text-5xl font-bold text-slate-800">{activeCases.length}</div>
        </div>
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl p-6 flex flex-col items-center justify-center">
          <div className="text-slate-500 font-medium mb-2">รถยนต์ชนเสา</div>
          <div className="text-5xl font-bold text-blue-600">{typeData[0].value}</div>
        </div>
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl p-6 flex flex-col items-center justify-center">
          <div className="text-slate-500 font-medium mb-2">ค้างชำระ</div>
          <div className="text-5xl font-bold text-emerald-600">{typeData[1].value}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">สัดส่วนประเภทคดี</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value">
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {typeData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-sm text-slate-600">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/40 rounded-3xl p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">คดีแยกตามสถานะ</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// Kanban Board Component
const KanbanBoard = ({ cases, dropdowns, onUpdate }: { cases: any[], dropdowns: Dropdowns, onUpdate: () => void }) => {
  const activeCases = cases.filter(c => !c.isArchived);
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
                              className={`mb-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm transition-all ${
                                snapshot.isDragging ? 'shadow-xl scale-105 rotate-2 z-50' : 'hover:shadow-md hover:border-blue-300'
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

// List View Component
const ListView = ({ cases, dropdowns, onUpdate }: { cases: any[], dropdowns: Dropdowns, onUpdate: () => void }) => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const itemsPerPage = 8;

  const activeCases = cases.filter(c => !c.isArchived);

  const filteredCases = activeCases.filter(c => 
    (c.docNumber || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.lawyerName || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.sourceName || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.driverName || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.referenceNumber || "").toLowerCase().includes(search.toLowerCase())
  );

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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/50 bg-slate-50/50">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">เลขที่หนังสือ</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">ประเภทคดี</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">วันที่รับเรื่อง</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">ต้นทาง</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">สถานะงาน</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">ทนาย</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">ไม่พบข้อมูลคดี</td>
                </tr>
              ) : (
                paginatedCases.map((c) => (
                  <tr 
                    key={c.id} 
                    onClick={() => setSelectedCase(c)}
                    className="border-b border-slate-100 last:border-0 hover:bg-white/80 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4 font-medium text-slate-800 group-hover:text-indigo-600 transition-colors">{c.docNumber}</td>
                    <td className="px-6 py-4">
                      {c.taskType === 'car_crash' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          <Car className="w-3.5 h-3.5" /> รถชนเสา
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CreditCard className="w-3.5 h-3.5" /> ค้างชำระ
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.receiveDate}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.sourceName}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border
                        ${c.taskStateName === 'เสร็จสิ้น' ? 'bg-green-50 text-green-700 border-green-100' : 
                          c.taskStateName === 'กำลังดำเนินการ' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                          'bg-slate-100 text-slate-700 border-slate-200'}`}
                      >
                        {c.taskStateName}
                      </span>
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
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200/50 bg-white/40">
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
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                      currentPage === i + 1 
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' 
                        : 'text-slate-600 hover:bg-white/80'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
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
    taskState: '',
    lawyer: '',
    licensePlate: '',
    driverName: '',
    damageAmount: '',
    referenceNumber: '',
    overdueBillStart: '',
    overdueBillEnd: '',
    amount: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value as string);
      });
      if (file) data.append('courtDocument', file);

      const response = await fetch('/api/cases', {
        method: 'POST',
        body: data,
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({
          taskType: 'car_crash', source: '', receiveDate: '', docNumber: '', docState: '', returnDocNumber: '', taskState: '', lawyer: '', licensePlate: '', driverName: '', damageAmount: '', referenceNumber: '', overdueBillStart: '', overdueBillEnd: '', amount: '',
        });
        setFile(null);
        onSuccess();
        setTimeout(() => setSubmitStatus('idle'), 3000);
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
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">สร้างรายการใหม่</h2>
        <p className="text-slate-500 mt-2">กรอกข้อมูลรายละเอียดคดีเพื่อบันทึกลงในระบบ</p>
      </div>

      <form onSubmit={handleSubmit}>
        <CaseFormFields 
          formData={formData} 
          setFormData={setFormData} 
          file={file} 
          setFile={setFile} 
          dropdowns={dropdowns} 
          isEditMode={false}
        />

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-4 rounded-2xl font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-xl shadow-blue-500/30 transition-all disabled:opacity-70 flex items-center gap-2"
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

        <AnimatePresence>
          {submitStatus === 'success' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <p className="font-medium">บันทึกข้อมูลสำเร็จเรียบร้อยแล้ว</p>
            </motion.div>
          )}
          {submitStatus === 'error' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง</p>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
};

// Main App Component
function App() {
  const [currentView, setCurrentView] = useState<'stats' | 'list' | 'kanban' | 'create'>('stats');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [cases, setCases] = useState<any[]>([]);
  const [dropdowns, setDropdowns] = useState<Dropdowns>({
    source: [], docState: [], taskState: [], lawyer: []
  });

  const fetchData = async () => {
    try {
      const [source, docState, taskState, lawyer, casesData] = await Promise.all([
        fetch('/api/sheets/source').then(res => res.json()),
        fetch('/api/sheets/doc_state').then(res => res.json()),
        fetch('/api/sheets/task_state').then(res => res.json()),
        fetch('/api/sheets/lawyer').then(res => res.json()),
        fetch('/api/cases').then(res => res.json())
      ]);
      // Normalize responses into DropdownOption[] (id,label)
      const toDropdown = (data: any): DropdownOption[] => {
        if (!data) return [];
        // if wrapper object with options/normalized/rows
        if (data.options && Array.isArray(data.options)) return toDropdown(data.options);
        if (data.normalized && Array.isArray(data.normalized)) return toDropdown(data.normalized);
        if (data.rows && Array.isArray(data.rows)) {
          const rows = data.rows;
          if (rows.length === 0) return [];
          const keys = Object.keys(rows[0]);
          if (keys.length >= 2) return rows.map(r => ({ id: String(r[keys[0]] ?? ''), label: String(r[keys[1]] ?? '') }));
          return rows.map((r: any, i: number) => ({ id: String(i + 1), label: String(r[keys[0]] ?? '') }));
        }
        if (Array.isArray(data)) {
          if (data.length === 0) return [];
          const first = data[0];
          if (first && typeof first === 'object') {
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

      setDropdowns({ source: toDropdown(source), docState: toDropdown(docState), taskState: toDropdown(taskState), lawyer: toDropdown(lawyer) });
      setCases(casesData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const navItems = [
    { id: 'stats', label: 'สถิติภาพรวม', icon: BarChart2 },
    { id: 'list', label: 'รายการคดี', icon: LayoutDashboard },
    { id: 'kanban', label: 'กระดานงาน', icon: Trello },
    { id: 'create', label: 'สร้างรายการใหม่', icon: PlusCircle },
  ];

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex font-sans selection:bg-blue-200">
      {/* Sidebar (Desktop) */}
      <aside 
        className={`hidden md:flex flex-col bg-white/80 backdrop-blur-3xl border-r border-white/40 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'w-24' : 'w-72'
        }`}
      >
        <div className={`p-8 flex items-center ${isSidebarCollapsed ? 'justify-center px-4' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
              <FileText className="w-6 h-6 text-white" />
            </div>
            {!isSidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight whitespace-nowrap">ระบบจัดการคดี</h1>
                <p className="text-xs text-slate-500 mt-0.5">Legal Case Management</p>
              </motion.div>
            )}
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map(item => (
            <button 
              key={item.id}
              onClick={() => setCurrentView(item.id as any)}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all group ${
                currentView === item.id 
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

        <div className="p-4 border-t border-slate-200/50 flex justify-center">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
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
                  className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-medium transition-all ${
                    currentView === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
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
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0 relative">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-br from-blue-100/40 via-purple-100/40 to-emerald-100/40 pointer-events-none" />
        <div className="absolute top-20 right-20 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
          {/* Prototype Banner */}
          <div className="mb-8 p-4 bg-amber-50/80 backdrop-blur-md border border-amber-200/50 rounded-2xl flex items-start gap-3 text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">โหมด Prototype (จำลองข้อมูล)</p>
              <p className="mt-1 opacity-80">ระบบกำลังแสดงผลด้วยข้อมูลจำลอง การเชื่อมต่อ Google Sheets และ Google Drive จำเป็นต้องตั้งค่า Service Account ในฝั่ง Server ก่อนนำไปใช้งานจริง</p>
            </div>
          </div>

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
              {currentView === 'kanban' && <KanbanBoard cases={cases} dropdowns={dropdowns} onUpdate={fetchData} />}
              {currentView === 'create' && <CreateForm dropdowns={dropdowns} onSuccess={fetchData} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;
