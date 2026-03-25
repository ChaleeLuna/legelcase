เก็บไฟล์ Word template สำหรับการสร้างเอกสารอัตโนมัติตาม `TaskType`

รูปแบบตัวแปรใน template:
- ใช้ `{{ชื่อตัวแปร}}`
- ตัวอย่าง `{{docNumber}}`
- ตัวอย่าง `{{receiveDate_thdate_full}}`

ตัวแปรช่วยสำหรับคดี `fine`:
- `{{fn_feeItemsText}}` สำหรับพิมพ์รายการค่าใช้จ่ายทั้งหมดเป็นหลายบรรทัดในครั้งเดียว
- `{{fn_feeItemsBlock}}` ตัวเดียวกับ `fn_feeItemsText` แต่ตั้งชื่อให้สื่อว่าเป็นบล็อกข้อความ
- `{{fn_feeItems}}` สำหรับใช้กับ loop แบบ `FOR`
- `{{fn_feeItemsParagraphs}}` สำหรับทำให้ Word ออกทีละย่อหน้าแบบเสถียรกว่า `\n`

ตัวแปร `fn_feeItemsBlock`, `fn_feeItemsText`, และ `fn_feeItemsParagraphs` ถูกส่งเข้า `additionalJsContext` ด้วย เผื่อ template เห็นจาก `data` ไม่ครบในบางกรณี

ตัวอย่าง `fn_feeItemsText`:
```text
1. ค่า X จำนวนเงิน 300 บาท
2. ค่า Y จำนวนเงิน 800 บาท
3. ค่าละเมิด จำนวนเงิน 5000 บาท
```

ตัวอย่าง `fn_feeItems`:
```text
{{FOR item IN fn_feeItems}}
{{item.index}}. {{item.name}} จำนวนเงิน {{item.amount}} บาท
{{END-FOR}}
```

ถ้า `\n` ไม่ขึ้นบรรทัดใหม่ใน Word ให้ใช้แบบนี้แทน:
```text
{{FOR item IN fn_feeItemsParagraphs}}
{{item.text}}
{{END-FOR}}
```

ระบบฝั่ง server เปิด `processLineBreaksAsNewText` ไว้แล้ว เพื่อให้ `{{fn_feeItemsText}}` รองรับขึ้นบรรทัดใหม่ได้ดีขึ้นใน Word รุ่นที่บางทีตีความ `\n` ต่างกัน

ชื่อไฟล์ที่ระบบรองรับ:
- `car_crash.docx`
- `overdue_payment.docx`
- `fine.docx`

ตัวอย่างคีย์วันที่ที่ระบบสร้างเพิ่มให้อัตโนมัติเมื่อค่าต้นฉบับเป็นรูปแบบวันที่:
- `receiveDate_thdate_full` = `8 มกราคม 2569`
- `receiveDate_thdate_short` = `8 ม.ค. 2569`
- `receiveDate_thmonth_full` = `มกราคม 2569`
- `receiveDate_thmonth_short` = `ม.ค. 2569`

หมายเหตุ:
- ระบบยัง fallback ไปหาไฟล์ในโฟลเดอร์ `templates/` เดิมได้ เพื่อไม่ให้กระทบไฟล์ที่มีอยู่แล้ว
- ถ้าจะย้ายมาใช้โฟลเดอร์นี้ทั้งหมด ให้วางไฟล์ template ตามชื่อด้านบน
