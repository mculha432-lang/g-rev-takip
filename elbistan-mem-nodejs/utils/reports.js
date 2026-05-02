const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

// Rapor dizini
const REPORTS_DIR = path.join(__dirname, '..', 'public', 'reports');

// Dizin kontrolü
function ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}

// Tarih formatla
function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Durum çevir
function translateStatus(status) {
    const statuses = {
        'pending': 'Beklemede',
        'in_progress': 'Devam Ediyor',
        'completed': 'Tamamlandı',
        'rejected': 'İade Edildi'
    };
    return statuses[status] || status;
}

// ==================== EXCEL RAPORLARI ====================

// Görev Özet Raporu (Excel)
async function generateTaskSummaryExcel() {
    ensureReportsDir();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Elbistan İlçe MEM';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Görev Özeti');

    // Başlık stilleri
    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE31E24' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
        }
    };

    // Sütunlar
    sheet.columns = [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Görev Adı', key: 'title', width: 40 },
        { header: 'Son Tarih', key: 'deadline', width: 15 },
        { header: 'Toplam Atama', key: 'total', width: 15 },
        { header: 'Tamamlanan', key: 'completed', width: 15 },
        { header: 'Bekleyen', key: 'pending', width: 15 },
        { header: 'Oran (%)', key: 'rate', width: 12 }
    ];

    // Başlık satırına stil uygula
    sheet.getRow(1).eachCell(cell => {
        Object.assign(cell, headerStyle);
    });
    sheet.getRow(1).height = 25;

    // Verileri al
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY id DESC').all();

    tasks.forEach(task => {
        const assignments = db.prepare('SELECT * FROM task_assignments WHERE task_id = ?').all(task.id);
        const total = assignments.length;
        const completed = assignments.filter(a => a.status === 'completed').length;
        const pending = total - completed;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        sheet.addRow({
            id: task.id,
            title: task.title,
            deadline: formatDate(task.deadline),
            total,
            completed,
            pending,
            rate
        });
    });

    // Dosyayı kaydet
    const fileName = `gorev_ozeti_${Date.now()}.xlsx`;
    const filePath = path.join(REPORTS_DIR, fileName);
    await workbook.xlsx.writeFile(filePath);

    return { fileName, filePath };
}

// Okul Performans Raporu (Excel)
async function generateSchoolPerformanceExcel() {
    ensureReportsDir();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Okul Performansı');

    // Sütunlar
    sheet.columns = [
        { header: 'Kurum Kodu', key: 'code', width: 15 },
        { header: 'Okul Adı', key: 'name', width: 45 },
        { header: 'Okul Türü', key: 'type', width: 15 },
        { header: 'Toplam Görev', key: 'total', width: 15 },
        { header: 'Tamamlanan', key: 'completed', width: 15 },
        { header: 'Başarı Oranı', key: 'rate', width: 15 }
    ];

    // Başlık stili
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Verileri al
    const schools = db.prepare("SELECT * FROM users WHERE role = 'school' ORDER BY full_name ASC").all();

    schools.forEach(school => {
        const assignments = db.prepare('SELECT * FROM task_assignments WHERE user_id = ?').all(school.id);
        const total = assignments.length;
        const completed = assignments.filter(a => a.status === 'completed').length;
        const rate = total > 0 ? Math.round((completed / total) * 100) + '%' : '-';

        sheet.addRow({
            code: school.username,
            name: school.full_name,
            type: school.school_type || 'Diğer',
            total,
            completed,
            rate
        });
    });

    const fileName = `okul_performansi_${Date.now()}.xlsx`;
    const filePath = path.join(REPORTS_DIR, fileName);
    await workbook.xlsx.writeFile(filePath);

    return { fileName, filePath };
}

// Detaylı Görev Raporu (Excel) - Belirli bir görev için (Form cevapları dahil)
async function generateTaskDetailExcel(taskId) {
    ensureReportsDir();

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) return null;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Görev Detayı');

    // Görev bilgileri
    const stripHtml = (html) => html ? html.replace(/<[^>]*>?/gm, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '-';

    sheet.addRow(['Görev Bilgileri']);
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.addRow(['Görev Adı:', task.title]);
    sheet.addRow(['Açıklama:', stripHtml(task.description)]);
    sheet.addRow(['Son Tarih:', formatDate(task.deadline)]);
    sheet.addRow([]);

    // Form alanlarını getir
    const taskFields = db.prepare('SELECT * FROM task_fields WHERE task_id = ? ORDER BY field_order ASC').all(taskId);

    // Başlık satırı - temel sütunlar + form alanları
    const headers = ['Okul', 'Kurum Kodu', 'Durum', 'Okundu', 'Yanıt Notu', 'Dosya'];
    taskFields.forEach(field => {
        headers.push(field.field_label);
    });

    sheet.addRow(headers);
    const headerRow = sheet.lastRow;
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const assignments = db.prepare(`
        SELECT ta.*, u.full_name, u.username
        FROM task_assignments ta
        JOIN users u ON ta.user_id = u.id
        WHERE ta.task_id = ?
        ORDER BY ta.status, u.full_name
    `).all(taskId);

    assignments.forEach(a => {
        // Form cevaplarını getir
        const responses = db.prepare(`
            SELECT tfr.*, tf.field_label 
            FROM task_field_responses tfr 
            JOIN task_fields tf ON tfr.field_id = tf.id 
            WHERE tfr.assignment_id = ?
        `).all(a.id);

        // Cevapları field_id'ye göre map'le
        const responseMap = {};
        responses.forEach(r => {
            responseMap[r.field_id] = r.response_value;
        });

        // Dosya linki oluştur (BASE_URL veya hardcoded)
        const baseUrl = process.env.BASE_URL || 'https://elbmemgts.com.tr';
        const fileObj = a.response_file 
            ? { text: a.response_file, hyperlink: `${baseUrl}/uploads/responses/${a.response_file}`, tooltip: 'Dosyayı İndir' }
            : '-';

        // Satır verileri
        const rowData = [
            a.full_name,
            a.username,
            translateStatus(a.status),
            a.is_read ? 'Evet' : 'Hayır',
            a.response_note || '-',
            fileObj
        ];

        // Form alanı cevaplarını ekle
        taskFields.forEach(field => {
            let val = responseMap[field.id] || '-';
            // Array/Checkbox verisini düzgün string'e çevir
            if (typeof val === 'string' && val.startsWith('[')) {
                try { val = JSON.parse(val).join(', '); } catch(e){}
            }
            rowData.push(val);
        });

        const row = sheet.addRow(rowData);

        // Stilleri ayarla (Hücre taşımasını önleme ve kenarlık ekleme)
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
            if (cell.value && cell.value.hyperlink) {
                cell.font = { color: { argb: 'FF0563C1' }, underline: true };
            }
        });

        // Duruma göre satır renklendirme
        if (a.status === 'completed') {
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        } else if (a.status === 'rejected') {
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
        }
    });

    // Sütun genişlikleri
    const columnWidths = [
        { width: 40 },  // Okul
        { width: 15 },  // Kurum Kodu
        { width: 15 },  // Durum
        { width: 10 },  // Okundu
        { width: 30 },  // Yanıt Notu
        { width: 25 }   // Dosya
    ];

    // Form alanları için sütun genişlikleri
    taskFields.forEach(() => {
        columnWidths.push({ width: 25 });
    });

    sheet.columns = columnWidths;

    // Özet bilgileri
    sheet.addRow([]);
    sheet.addRow([]);
    const summaryRow = sheet.addRow(['ÖZET']);
    summaryRow.font = { bold: true, size: 12 };

    const totalAssignments = assignments.length;
    const completedCount = assignments.filter(a => a.status === 'completed').length;
    const pendingCount = assignments.filter(a => a.status === 'pending').length;
    const inProgressCount = assignments.filter(a => a.status === 'in_progress').length;
    const rejectedCount = assignments.filter(a => a.status === 'rejected').length;

    sheet.addRow(['Toplam Atama:', totalAssignments]);
    sheet.addRow(['Tamamlanan:', completedCount]);
    sheet.addRow(['İşlemde:', inProgressCount]);
    sheet.addRow(['Bekleyen:', pendingCount]);
    sheet.addRow(['İade Edilen:', rejectedCount]);
    sheet.addRow(['Tamamlanma Oranı:', totalAssignments > 0 ? `%${Math.round(completedCount / totalAssignments * 100)}` : '%0']);

    const fileName = `gorev_${taskId}_detay_${Date.now()}.xlsx`;
    const filePath = path.join(REPORTS_DIR, fileName);
    await workbook.xlsx.writeFile(filePath);

    return { fileName, filePath };
}

// ==================== PDF RAPORLARI ====================

// Renk paleti
const COLORS = {
    primary:    '#B91C1C',   // Koyu kırmızı
    primaryLt:  '#FEF2F2',   // Açık kırmızı bg
    dark:       '#111827',   // Başlık metni
    text:       '#374151',   // Normal metin
    muted:      '#6B7280',   // Soluk metin
    border:     '#D1D5DB',   // Kenar çizgisi
    headerBg:   '#1E293B',   // Tablo başlık bg
    headerTxt:  '#FFFFFF',   // Tablo başlık metin
    rowEven:    '#F8FAFC',   // Çift satır bg
    green:      '#059669',
    greenLt:    '#ECFDF5',
    blue:       '#2563EB',
    blueLt:     '#EFF6FF',
    orange:     '#D97706',
    orangeLt:   '#FFFBEB',
};

// Hex rengi RGB dizisine çevir
function hexToRGB(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

// Yuvarlak köşeli dikdörtgen (stat card)
function drawRoundedRect(doc, x, y, w, h, r, fillColor) {
    const rgb = hexToRGB(fillColor);
    doc.save();
    doc.roundedRect(x, y, w, h, r).fill(rgb);
    doc.restore();
}

// Görev Özet PDF
async function generateTaskSummaryPDF() {
    ensureReportsDir();

    return new Promise((resolve, reject) => {
        const fileName = `gorev_ozeti_${Date.now()}.pdf`;
        const filePath = path.join(REPORTS_DIR, fileName);

        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 60, left: 50, right: 50 },
            bufferPages: true,
            info: {
                Title: 'Görev Özet Raporu',
                Author: 'Elbistan İlçe Milli Eğitim Müdürlüğü',
                Subject: 'Görev Takip Sistemi Raporu',
                Creator: 'E-GTS v1.0'
            }
        });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // ── Fontları kaydet ──
        const fontPath = path.join(__dirname, '..', 'fonts', 'arial.ttf');
        const fontBoldPath = path.join(__dirname, '..', 'fonts', 'arialbd.ttf');
        doc.registerFont('Arial', fontPath);
        doc.registerFont('ArialBd', fontBoldPath);
        doc.font('Arial');

        const pageW = doc.page.width;
        const marginL = doc.page.margins.left;
        const marginR = doc.page.margins.right;
        const contentW = pageW - marginL - marginR;

        // ── LOGO + BAŞLIK ALANI ──
        const logoPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');
        const headerTop = 35;

        // Üst kırmızı çizgi
        doc.save();
        doc.rect(0, 0, pageW, 4).fill(hexToRGB(COLORS.primary));
        doc.restore();

        // Logo (sol)
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, marginL, headerTop, { width: 60, height: 60 });
        }

        // Logo (sağ — aynı logo)
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, pageW - marginR - 60, headerTop, { width: 60, height: 60 });
        }

        // Başlık metinleri (ortalanmış)
        const titleCenterX = marginL + 70;
        const titleW = contentW - 140;
        doc.font('ArialBd').fontSize(8).fillColor(hexToRGB(COLORS.muted));
        doc.text('T.C.', titleCenterX, headerTop + 2, { width: titleW, align: 'center' });

        doc.font('ArialBd').fontSize(11).fillColor(hexToRGB(COLORS.dark));
        doc.text('ELBİSTAN İLÇE MİLLİ EĞİTİM MÜDÜRLÜĞÜ', titleCenterX, headerTop + 14, { width: titleW, align: 'center' });

        doc.font('Arial').fontSize(9).fillColor(hexToRGB(COLORS.text));
        doc.text('Görev Takip Sistemi', titleCenterX, headerTop + 29, { width: titleW, align: 'center' });

        doc.font('Arial').fontSize(8).fillColor(hexToRGB(COLORS.muted));
        doc.text('Elektronik Görev Takip Sistemi', titleCenterX, headerTop + 42, { width: titleW, align: 'center' });

        // Başlık altı çizgi
        doc.save();
        doc.moveTo(marginL, headerTop + 68).lineTo(pageW - marginR, headerTop + 68).lineWidth(1.5).strokeColor(hexToRGB(COLORS.primary)).stroke();
        doc.moveTo(marginL, headerTop + 71).lineTo(pageW - marginR, headerTop + 71).lineWidth(0.5).strokeColor(hexToRGB(COLORS.border)).stroke();
        doc.restore();

        // Belge numarası ve tarih
        const now = new Date();
        const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        doc.font('Arial').fontSize(8).fillColor(hexToRGB(COLORS.muted));
        doc.text(`Rapor No: GTS-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-5)}`, marginL, headerTop + 78);
        doc.text(`Tarih: ${dateStr}  Saat: ${timeStr}`, marginL, headerTop + 78, { width: contentW, align: 'right' });

        // ── RAPOR BAŞLIĞI ──
        const reportTitleY = headerTop + 98;
        drawRoundedRect(doc, marginL, reportTitleY, contentW, 32, 6, COLORS.primaryLt);
        doc.save();
        doc.roundedRect(marginL, reportTitleY, contentW, 32, 6).lineWidth(1).strokeColor(hexToRGB('#FECACA')).stroke();
        doc.restore();
        doc.font('ArialBd').fontSize(14).fillColor(hexToRGB(COLORS.primary));
        doc.text('GÖREV ÖZET RAPORU', marginL, reportTitleY + 9, { width: contentW, align: 'center' });

        // ── İSTATİSTİK VERİLERİ ──
        const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
        const totalAssignments = db.prepare('SELECT COUNT(*) as count FROM task_assignments').get().count;
        const completedAssignments = db.prepare("SELECT COUNT(*) as count FROM task_assignments WHERE status = 'completed'").get().count;
        const pendingAssignments = db.prepare("SELECT COUNT(*) as count FROM task_assignments WHERE status IN ('pending','in_progress')").get().count;
        const successRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

        // ── STAT KARTLARI ──
        const cardsY = reportTitleY + 46;
        const cardW = (contentW - 18) / 4;  // 4 kart, 6px boşluk
        const cardH = 54;

        const statCards = [
            { label: 'Toplam Görev', value: String(totalTasks), bg: COLORS.blueLt, color: COLORS.blue, border: '#BFDBFE' },
            { label: 'Toplam Atama', value: String(totalAssignments), bg: COLORS.orangeLt, color: COLORS.orange, border: '#FDE68A' },
            { label: 'Tamamlanan', value: String(completedAssignments), bg: COLORS.greenLt, color: COLORS.green, border: '#A7F3D0' },
            { label: 'Başarı Oranı', value: `%${successRate}`, bg: COLORS.primaryLt, color: COLORS.primary, border: '#FECACA' },
        ];

        statCards.forEach((card, i) => {
            const cx = marginL + i * (cardW + 6);
            drawRoundedRect(doc, cx, cardsY, cardW, cardH, 6, card.bg);
            doc.save();
            doc.roundedRect(cx, cardsY, cardW, cardH, 6).lineWidth(0.8).strokeColor(hexToRGB(card.border)).stroke();
            doc.restore();

            doc.font('ArialBd').fontSize(18).fillColor(hexToRGB(card.color));
            doc.text(card.value, cx, cardsY + 8, { width: cardW, align: 'center' });

            doc.font('Arial').fontSize(7.5).fillColor(hexToRGB(COLORS.muted));
            doc.text(card.label, cx, cardsY + 32, { width: cardW, align: 'center' });
        });

        // ── GÖREV TABLOSU ──
        const tableTopY = cardsY + cardH + 20;

        // Tablo başlığı
        doc.font('ArialBd').fontSize(10).fillColor(hexToRGB(COLORS.dark));
        doc.text('GÖREV LİSTESİ', marginL, tableTopY);

        const tasks = db.prepare('SELECT * FROM tasks ORDER BY id DESC').all();

        // Tablo çizelgesi
        const colWidths = [22, 218, 60, 50, 50, 50, 45];
        const headers = ['#', 'Görev Adı', 'Son Tarih', 'Atama', 'Tamamlanan', 'Bekleyen', 'Oran'];
        const tableX = marginL;
        let rowY = tableTopY + 18;
        const rowH = 22;
        const headerH = 26;

        // Tablo başlık satırı
        drawRoundedRect(doc, tableX, rowY, contentW, headerH, 4, COLORS.headerBg);
        let colX = tableX;
        headers.forEach((h, i) => {
            doc.font('ArialBd').fontSize(7.5).fillColor(hexToRGB(COLORS.headerTxt));
            doc.text(h, colX + 4, rowY + 8, { width: colWidths[i] - 8, align: i === 1 ? 'left' : 'center' });
            colX += colWidths[i];
        });
        rowY += headerH;

        // Tablo satırları
        tasks.forEach((task, idx) => {
            // Sayfa kontrolü
            if (rowY + rowH > doc.page.height - 80) {
                doc.addPage();
                rowY = 50;
                // Yeni sayfada başlık satırını tekrarla
                drawRoundedRect(doc, tableX, rowY, contentW, headerH, 4, COLORS.headerBg);
                let hx = tableX;
                headers.forEach((h, i) => {
                    doc.font('ArialBd').fontSize(7.5).fillColor(hexToRGB(COLORS.headerTxt));
                    doc.text(h, hx + 4, rowY + 8, { width: colWidths[i] - 8, align: i === 1 ? 'left' : 'center' });
                    hx += colWidths[i];
                });
                rowY += headerH;
            }

            const assignments = db.prepare('SELECT * FROM task_assignments WHERE task_id = ?').all(task.id);
            const total = assignments.length;
            const completed = assignments.filter(a => a.status === 'completed').length;
            const pending = total - completed;
            const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

            // Zebra çizgileme
            if (idx % 2 === 0) {
                doc.save();
                doc.rect(tableX, rowY, contentW, rowH).fill(hexToRGB(COLORS.rowEven));
                doc.restore();
            }

            // Alt çizgi
            doc.save();
            doc.moveTo(tableX, rowY + rowH).lineTo(tableX + contentW, rowY + rowH).lineWidth(0.3).strokeColor(hexToRGB(COLORS.border)).stroke();
            doc.restore();

            const rowData = [
                String(idx + 1),
                task.title && task.title.length > 45 ? task.title.substring(0, 42) + '...' : (task.title || '-'),
                formatDate(task.deadline),
                String(total),
                String(completed),
                String(pending),
                `%${rate}`
            ];

            colX = tableX;
            rowData.forEach((val, i) => {
                // Oran sütununda renkli badge
                if (i === 6) {
                    const rateNum = parseInt(val.replace('%', ''));
                    let badgeColor = COLORS.primary;
                    let badgeBg = COLORS.primaryLt;
                    if (rateNum >= 80) { badgeColor = COLORS.green; badgeBg = COLORS.greenLt; }
                    else if (rateNum >= 50) { badgeColor = COLORS.orange; badgeBg = COLORS.orangeLt; }
                    else if (rateNum >= 1) { badgeColor = COLORS.blue; badgeBg = COLORS.blueLt; }

                    drawRoundedRect(doc, colX + 8, rowY + 4, colWidths[i] - 16, 14, 3, badgeBg);
                    doc.font('ArialBd').fontSize(7).fillColor(hexToRGB(badgeColor));
                    doc.text(val, colX + 4, rowY + 6, { width: colWidths[i] - 8, align: 'center' });
                } else {
                    doc.font(i === 1 ? 'ArialBd' : 'Arial').fontSize(7.5).fillColor(hexToRGB(i === 1 ? COLORS.dark : COLORS.text));
                    doc.text(val, colX + 4, rowY + 6, { width: colWidths[i] - 8, align: i === 1 ? 'left' : 'center' });
                }
                colX += colWidths[i];
            });

            rowY += rowH;
        });

        // Tablo alt kenarı
        doc.save();
        doc.moveTo(tableX, rowY).lineTo(tableX + contentW, rowY).lineWidth(1).strokeColor(hexToRGB(COLORS.primary)).stroke();
        doc.restore();

        // ── ÖZET KUTUSU ──
        if (rowY + 80 > doc.page.height - 80) {
            doc.addPage();
            rowY = 50;
        }
        rowY += 14;

        drawRoundedRect(doc, marginL, rowY, contentW, 60, 6, '#F0F4FF');
        doc.save();
        doc.roundedRect(marginL, rowY, contentW, 60, 6).lineWidth(0.8).strokeColor(hexToRGB('#BFDBFE')).stroke();
        doc.restore();

        doc.font('ArialBd').fontSize(9).fillColor(hexToRGB(COLORS.blue));
        doc.text('ÖZET BİLGİLER', marginL + 14, rowY + 8);

        doc.font('Arial').fontSize(8).fillColor(hexToRGB(COLORS.text));
        const summaryCol1X = marginL + 14;
        const summaryCol2X = marginL + contentW / 2;
        doc.text(`Toplam Görev Sayısı: ${totalTasks}`, summaryCol1X, rowY + 24);
        doc.text(`Toplam Atama Sayısı: ${totalAssignments}`, summaryCol1X, rowY + 38);
        doc.text(`Tamamlanan Görev: ${completedAssignments}`, summaryCol2X, rowY + 24);
        doc.text(`Bekleyen Görev: ${pendingAssignments}`, summaryCol2X, rowY + 38);

        // ── SAYFA NUMARALARI + FOOTER ──
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            doc.page.margins.bottom = 0;

            // Alt kırmızı çizgi
            const footerY = doc.page.height - 45;
            doc.save();
            doc.moveTo(marginL, footerY).lineTo(pageW - marginR, footerY).lineWidth(0.5).strokeColor(hexToRGB(COLORS.primary)).stroke();
            doc.restore();

            // Footer metinleri
            doc.font('Arial').fontSize(7).fillColor(hexToRGB(COLORS.muted));
            doc.text(
                'Elbistan İlçe Milli Eğitim Müdürlüğü — Elektronik Görev Takip Sistemi (E-GTS)',
                marginL, footerY + 6,
                { width: contentW, align: 'left' }
            );
            doc.text(
                `Sayfa ${i + 1} / ${totalPages}`,
                marginL, footerY + 6,
                { width: contentW, align: 'right' }
            );

            doc.font('Arial').fontSize(6).fillColor(hexToRGB(COLORS.muted));
            doc.text(
                `Bu rapor ${dateStr} tarihinde ${timeStr} saatinde otomatik olarak oluşturulmuştur.`,
                marginL, footerY + 18,
                { width: contentW, align: 'center' }
            );
        }

        doc.end();

        stream.on('finish', () => resolve({ fileName, filePath }));
        stream.on('error', reject);
    });
}

// Okul Performans Raporu (PDF)
async function generateSchoolPerformancePDF() {
    ensureReportsDir();

    return new Promise((resolve, reject) => {
        const fileName = `okul_performansi_${Date.now()}.pdf`;
        const filePath = path.join(REPORTS_DIR, fileName);

        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 60, left: 50, right: 50 },
            bufferPages: true,
            info: {
                Title: 'Okul Performans Raporu',
                Author: 'Elbistan İlçe Milli Eğitim Müdürlüğü',
                Subject: 'Okul Bazlı Görev Performans Raporu',
                Creator: 'E-GTS v1.0'
            }
        });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Fontlar
        const fontPath = path.join(__dirname, '..', 'fonts', 'arial.ttf');
        const fontBoldPath = path.join(__dirname, '..', 'fonts', 'arialbd.ttf');
        doc.registerFont('Arial', fontPath);
        doc.registerFont('ArialBd', fontBoldPath);

        const pageW = doc.page.width;
        const marginL = doc.page.margins.left;
        const marginR = doc.page.margins.right;
        const contentW = pageW - marginL - marginR;
        const logoPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');

        // ── Ortak başlık fonksiyonu ──
        function drawPageHeader(isFirstPage) {
            const headerTop = 35;

            // Üst kırmızı çizgi
            doc.save();
            doc.rect(0, 0, pageW, 4).fill(hexToRGB(COLORS.primary));
            doc.restore();

            if (isFirstPage) {
                // Logo (sol)
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, marginL, headerTop, { width: 60, height: 60 });
                }
                // Logo (sağ)
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, pageW - marginR - 60, headerTop, { width: 60, height: 60 });
                }

                // Başlık metinleri
                const titleCenterX = marginL + 70;
                const titleW = contentW - 140;
                doc.font('ArialBd').fontSize(8).fillColor(hexToRGB(COLORS.muted));
                doc.text('T.C.', titleCenterX, headerTop + 2, { width: titleW, align: 'center' });

                doc.font('ArialBd').fontSize(11).fillColor(hexToRGB(COLORS.dark));
                doc.text('ELBİSTAN İLÇE MİLLİ EĞİTİM MÜDÜRLÜĞÜ', titleCenterX, headerTop + 14, { width: titleW, align: 'center' });

                doc.font('Arial').fontSize(9).fillColor(hexToRGB(COLORS.text));
                doc.text('Görev Takip Sistemi', titleCenterX, headerTop + 29, { width: titleW, align: 'center' });

                doc.font('Arial').fontSize(8).fillColor(hexToRGB(COLORS.muted));
                doc.text('Elektronik Görev Takip Sistemi', titleCenterX, headerTop + 42, { width: titleW, align: 'center' });

                // Çift çizgi
                doc.save();
                doc.moveTo(marginL, headerTop + 68).lineTo(pageW - marginR, headerTop + 68).lineWidth(1.5).strokeColor(hexToRGB(COLORS.primary)).stroke();
                doc.moveTo(marginL, headerTop + 71).lineTo(pageW - marginR, headerTop + 71).lineWidth(0.5).strokeColor(hexToRGB(COLORS.border)).stroke();
                doc.restore();

                // Rapor no & tarih
                doc.font('Arial').fontSize(8).fillColor(hexToRGB(COLORS.muted));
                doc.text(`Rapor No: OPR-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-5)}`, marginL, headerTop + 78);
                doc.text(`Tarih: ${dateStr}  Saat: ${timeStr}`, marginL, headerTop + 78, { width: contentW, align: 'right' });

                return headerTop + 98;
            }
            return 50;
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        let curY = drawPageHeader(true);

        // ── RAPOR BAŞLIĞI ──
        drawRoundedRect(doc, marginL, curY, contentW, 32, 6, COLORS.primaryLt);
        doc.save();
        doc.roundedRect(marginL, curY, contentW, 32, 6).lineWidth(1).strokeColor(hexToRGB('#FECACA')).stroke();
        doc.restore();
        doc.font('ArialBd').fontSize(14).fillColor(hexToRGB(COLORS.primary));
        doc.text('OKUL PERFORMANS RAPORU', marginL, curY + 9, { width: contentW, align: 'center' });
        curY += 46;

        // ── VERİLERİ TOPLA ──
        const schools = db.prepare("SELECT * FROM users WHERE role = 'school' ORDER BY full_name ASC").all();
        const schoolTypeMap = {
            'anaokulu': 'Anaokulu', 'ilkokul': 'İlkokul', 'ortaokul': 'Ortaokul',
            'lise': 'Lise', 'surucu_kursu': 'Sürücü Kursu', 'kurs': 'Özel Kurs',
            'rehabilitasyon': 'Rehab.', 'yurt': 'Özel Yurt', 'diger': 'Diğer'
        };

        let totalSchools = schools.length;
        let schoolsWithTasks = 0;
        let totalCompleted = 0;
        let totalAssigned = 0;

        const schoolData = schools.map(school => {
            const assignments = db.prepare('SELECT * FROM task_assignments WHERE user_id = ?').all(school.id);
            const total = assignments.length;
            const completed = assignments.filter(a => a.status === 'completed').length;
            const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
            if (total > 0) schoolsWithTasks++;
            totalCompleted += completed;
            totalAssigned += total;
            return {
                code: school.username,
                name: school.full_name,
                type: schoolTypeMap[school.school_type] || school.school_type || 'Diğer',
                total, completed, pending: total - completed, rate
            };
        });

        const overallRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

        // ── STAT KARTLARI ──
        const cardW = (contentW - 18) / 4;
        const cardH = 54;

        const statCards = [
            { label: 'Toplam Kurum', value: String(totalSchools), bg: COLORS.blueLt, color: COLORS.blue, border: '#BFDBFE' },
            { label: 'Görev Atanan', value: String(schoolsWithTasks), bg: COLORS.orangeLt, color: COLORS.orange, border: '#FDE68A' },
            { label: 'Tamamlanan', value: String(totalCompleted), bg: COLORS.greenLt, color: COLORS.green, border: '#A7F3D0' },
            { label: 'Genel Başarı', value: `%${overallRate}`, bg: COLORS.primaryLt, color: COLORS.primary, border: '#FECACA' },
        ];

        statCards.forEach((card, i) => {
            const cx = marginL + i * (cardW + 6);
            drawRoundedRect(doc, cx, curY, cardW, cardH, 6, card.bg);
            doc.save();
            doc.roundedRect(cx, curY, cardW, cardH, 6).lineWidth(0.8).strokeColor(hexToRGB(card.border)).stroke();
            doc.restore();
            doc.font('ArialBd').fontSize(18).fillColor(hexToRGB(card.color));
            doc.text(card.value, cx, curY + 8, { width: cardW, align: 'center' });
            doc.font('Arial').fontSize(7.5).fillColor(hexToRGB(COLORS.muted));
            doc.text(card.label, cx, curY + 32, { width: cardW, align: 'center' });
        });
        curY += cardH + 20;

        // ── OKUL TABLOSU ──
        doc.font('ArialBd').fontSize(10).fillColor(hexToRGB(COLORS.dark));
        doc.text('KURUM BAZLI PERFORMANS', marginL, curY);
        curY += 18;

        const colWidths = [20, 48, 237, 48, 38, 38, 38, 38];
        const headers = ['#', 'Kurum Kodu', 'Kurum Adı', 'Türü', 'Atama', 'Tamam', 'Bekl.', 'Oran'];
        const rowH = 20;
        const headerH = 24;

        // Başlık satırı çizme fonksiyonu
        function drawTableHeader(y) {
            drawRoundedRect(doc, marginL, y, contentW, headerH, 4, COLORS.headerBg);
            let cx = marginL;
            headers.forEach((h, i) => {
                doc.font('ArialBd').fontSize(7).fillColor(hexToRGB(COLORS.headerTxt));
                doc.text(h, cx + 3, y + 7, { width: colWidths[i] - 6, align: i === 2 ? 'left' : 'center' });
                cx += colWidths[i];
            });
            return y + headerH;
        }

        curY = drawTableHeader(curY);

        // Satırları çiz
        schoolData.forEach((s, idx) => {
            // İsmin kaç satır tutacağını hesapla (wrap desteği)
            const nameColW = colWidths[2] - 6;
            const nameText = s.name || '-';
            const nameHeight = doc.font('ArialBd').fontSize(7).heightOfString(nameText, { width: nameColW });
            const dynamicRowH = Math.max(rowH, nameHeight + 10);

            // Sayfa kontrolü
            if (curY + dynamicRowH > doc.page.height - 80) {
                doc.addPage();
                curY = drawTableHeader(50);
            }

            // Zebra
            if (idx % 2 === 0) {
                doc.save();
                doc.rect(marginL, curY, contentW, dynamicRowH).fill(hexToRGB(COLORS.rowEven));
                doc.restore();
            }

            // Alt çizgi
            doc.save();
            doc.moveTo(marginL, curY + dynamicRowH).lineTo(marginL + contentW, curY + dynamicRowH).lineWidth(0.3).strokeColor(hexToRGB(COLORS.border)).stroke();
            doc.restore();

            const rowData = [String(idx + 1), s.code || '-', nameText, s.type, String(s.total), String(s.completed), String(s.pending), `%${s.rate}`];

            let cx = marginL;
            rowData.forEach((val, i) => {
                const cellY = curY + (i === 2 ? 4 : Math.floor((dynamicRowH - 10) / 2));
                if (i === 7) {
                    // Oran badge
                    let badgeColor = COLORS.primary, badgeBg = COLORS.primaryLt;
                    if (s.rate >= 80) { badgeColor = COLORS.green; badgeBg = COLORS.greenLt; }
                    else if (s.rate >= 50) { badgeColor = COLORS.orange; badgeBg = COLORS.orangeLt; }
                    else if (s.rate >= 1) { badgeColor = COLORS.blue; badgeBg = COLORS.blueLt; }

                    const badgeY = curY + Math.floor((dynamicRowH - 14) / 2);
                    drawRoundedRect(doc, cx + 6, badgeY, colWidths[i] - 12, 14, 3, badgeBg);
                    doc.font('ArialBd').fontSize(7).fillColor(hexToRGB(badgeColor));
                    doc.text(val, cx + 3, badgeY + 2, { width: colWidths[i] - 6, align: 'center' });
                } else if (i === 2) {
                    // İsim sütunu — text wrapping ile tam göster
                    doc.font('ArialBd').fontSize(7).fillColor(hexToRGB(COLORS.dark));
                    doc.text(val, cx + 3, cellY, { width: nameColW, lineBreak: true });
                } else {
                    doc.font('Arial').fontSize(7).fillColor(hexToRGB(COLORS.text));
                    doc.text(val, cx + 3, cellY, { width: colWidths[i] - 6, align: 'center' });
                }
                cx += colWidths[i];
            });

            curY += dynamicRowH;
        });

        // Tablo alt kenar
        doc.save();
        doc.moveTo(marginL, curY).lineTo(marginL + contentW, curY).lineWidth(1).strokeColor(hexToRGB(COLORS.primary)).stroke();
        doc.restore();

        // ── ÖZET KUTUSU ──
        if (curY + 80 > doc.page.height - 80) {
            doc.addPage();
            curY = 50;
        }
        curY += 14;

        drawRoundedRect(doc, marginL, curY, contentW, 60, 6, '#F0F4FF');
        doc.save();
        doc.roundedRect(marginL, curY, contentW, 60, 6).lineWidth(0.8).strokeColor(hexToRGB('#BFDBFE')).stroke();
        doc.restore();

        doc.font('ArialBd').fontSize(9).fillColor(hexToRGB(COLORS.blue));
        doc.text('ÖZET BİLGİLER', marginL + 14, curY + 8);

        doc.font('Arial').fontSize(8).fillColor(hexToRGB(COLORS.text));
        const col1 = marginL + 14;
        const col2 = marginL + contentW / 2;
        doc.text(`Toplam Kurum Sayısı: ${totalSchools}`, col1, curY + 24);
        doc.text(`Görev Atanan Kurum: ${schoolsWithTasks}`, col1, curY + 38);
        doc.text(`Tamamlanan Görev: ${totalCompleted} / ${totalAssigned}`, col2, curY + 24);
        doc.text(`Genel Başarı Oranı: %${overallRate}`, col2, curY + 38);

        // ── FOOTER (tüm sayfalar) ──
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            doc.page.margins.bottom = 0;
            const footerY = doc.page.height - 45;

            doc.save();
            doc.moveTo(marginL, footerY).lineTo(pageW - marginR, footerY).lineWidth(0.5).strokeColor(hexToRGB(COLORS.primary)).stroke();
            doc.restore();

            doc.font('Arial').fontSize(7).fillColor(hexToRGB(COLORS.muted));
            doc.text('Elbistan İlçe Milli Eğitim Müdürlüğü — Elektronik Görev Takip Sistemi (E-GTS)', marginL, footerY + 6, { width: contentW, align: 'left' });
            doc.text(`Sayfa ${i + 1} / ${totalPages}`, marginL, footerY + 6, { width: contentW, align: 'right' });

            doc.font('Arial').fontSize(6).fillColor(hexToRGB(COLORS.muted));
            doc.text(`Bu rapor ${dateStr} tarihinde ${timeStr} saatinde otomatik olarak oluşturulmuştur.`, marginL, footerY + 18, { width: contentW, align: 'center' });
        }

        doc.end();

        stream.on('finish', () => resolve({ fileName, filePath }));
        stream.on('error', reject);
    });
}

// ==================== GİRİŞ-ÇIKIŞ RAPORU ====================

// Okul Giriş-Çıkış Raporu (Excel)
async function generateLoginActivityExcel(startDate, endDate) {
    ensureReportsDir();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Elbistan İlçe MEM';
    workbook.created = new Date();

    // ===== SAYFA 1: ÖZET =====
    const summarySheet = workbook.addWorksheet('Giriş-Çıkış Özeti');

    // Başlık
    summarySheet.mergeCells('A1:G1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'Elbistan İlçe MEM - Okul Giriş-Çıkış Raporu';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1E3A5A' } };
    titleCell.alignment = { horizontal: 'center' };

    summarySheet.mergeCells('A2:G2');
    const dateRangeCell = summarySheet.getCell('A2');
    const startLabel = startDate ? formatDate(startDate) : 'Tüm zamanlar';
    const endLabel = endDate ? formatDate(endDate) : 'Bugün';
    dateRangeCell.value = `Tarih Aralığı: ${startLabel} - ${endLabel}`;
    dateRangeCell.font = { size: 11, color: { argb: 'FF64748B' } };
    dateRangeCell.alignment = { horizontal: 'center' };

    summarySheet.addRow([]);

    // Sütunlar
    summarySheet.columns = [
        { width: 15 },  // Kurum Kodu
        { width: 45 },  // Okul Adı
        { width: 15 },  // Okul Türü
        { width: 18 },  // Toplam Giriş
        { width: 18 },  // Toplam Çıkış
        { width: 22 },  // Son Giriş Tarihi
        { width: 15 },  // Durum
    ];

    // Tablo başlıkları
    const headerRow = summarySheet.addRow(['Kurum Kodu', 'Okul Adı', 'Okul Türü', 'Toplam Giriş', 'Toplam Çıkış', 'Son Giriş Tarihi', 'Durum']);
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5A' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' }
        };
    });
    headerRow.height = 28;

    // Tarih filtresini SQL'e çevir
    let dateFilter = '';
    const params = [];
    if (startDate) {
        dateFilter += " AND l.created_at >= ?";
        params.push(startDate + ' 00:00:00');
    }
    if (endDate) {
        dateFilter += " AND l.created_at <= ?";
        params.push(endDate + ' 23:59:59');
    }

    // Tüm okulları al
    const schools = db.prepare("SELECT * FROM users WHERE role = 'school' ORDER BY full_name ASC").all();

    const schoolTypeMap = {
        'anaokulu': 'Anaokulu',
        'ilkokul': 'İlkokul',
        'ortaokul': 'Ortaokul',
        'lise': 'Lise',
        'surucu_kursu': 'Sürücü Kursu',
        'kurs': 'Özel Kurs',
        'rehabilitasyon': 'Rehabilitasyon',
        'yurt': 'Özel Yurt',
        'diger': 'Diğer'
    };

    let neverLoggedIn = 0;

    schools.forEach(school => {
        // Giriş sayısı
        const loginCount = db.prepare(`
            SELECT COUNT(*) as count FROM logs l
            WHERE l.user_id = ? AND l.action = 'Giriş Yaptı' ${dateFilter}
        `).get(school.id, ...params).count;

        // Çıkış sayısı
        const logoutCount = db.prepare(`
            SELECT COUNT(*) as count FROM logs l
            WHERE l.user_id = ? AND l.action = 'Çıkış Yaptı' ${dateFilter}
        `).get(school.id, ...params).count;

        // Son giriş tarihi
        const lastLogin = db.prepare(`
            SELECT l.created_at FROM logs l
            WHERE l.user_id = ? AND l.action = 'Giriş Yaptı' ${dateFilter}
            ORDER BY l.created_at DESC LIMIT 1
        `).get(school.id, ...params);

        const lastLoginStr = lastLogin ? new Date(lastLogin.created_at).toLocaleString('tr-TR') : 'Hiç giriş yapmadı';
        const status = loginCount > 0 ? 'Aktif' : 'Pasif';

        if (loginCount === 0) neverLoggedIn++;

        const row = summarySheet.addRow([
            school.username,
            school.full_name,
            schoolTypeMap[school.school_type] || school.school_type || 'Diğer',
            loginCount,
            logoutCount,
            lastLoginStr,
            status
        ]);

        // Satır stilleri
        row.eachCell(cell => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
            cell.alignment = { vertical: 'middle' };
        });

        // Pasif okulları kırmızımsı renkle işaretle
        if (loginCount === 0) {
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
            row.getCell(7).font = { bold: true, color: { argb: 'FFDC2626' } };
        } else {
            row.getCell(7).font = { bold: true, color: { argb: 'FF059669' } };
        }

        // Sayı hücrelerini ortala
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'center' };
    });

    // Özet satırları
    summarySheet.addRow([]);
    const summaryTitleRow = summarySheet.addRow(['ÖZET BİLGİLER']);
    summaryTitleRow.font = { bold: true, size: 13, color: { argb: 'FF1E3A5A' } };

    summarySheet.addRow(['Toplam Kurum:', schools.length]);
    summarySheet.addRow(['Giriş Yapan Kurum:', schools.length - neverLoggedIn]);
    summarySheet.addRow(['Hiç Giriş Yapmayan:', neverLoggedIn]);

    // ===== SAYFA 2: DETAY LOG =====
    const detailSheet = workbook.addWorksheet('Detaylı Giriş Logları');

    detailSheet.columns = [
        { header: 'Tarih / Saat', key: 'datetime', width: 22 },
        { header: 'Kurum Kodu', key: 'code', width: 15 },
        { header: 'Okul Adı', key: 'name', width: 45 },
        { header: 'İşlem', key: 'action', width: 18 },
        { header: 'IP Adresi', key: 'ip', width: 20 },
    ];

    // Detay başlık stili
    const detailHeaderRow = detailSheet.getRow(1);
    detailHeaderRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE31E24' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' }
        };
    });
    detailHeaderRow.height = 28;

    // Tüm logları çek (okulların giriş/çıkış)
    const allLogs = db.prepare(`
        SELECT l.*, u.username, u.full_name
        FROM logs l
        JOIN users u ON l.user_id = u.id
        WHERE u.role = 'school' AND l.action IN ('Giriş Yaptı', 'Çıkış Yaptı')
        ${dateFilter.replace(/l\./g, 'l.')}
        ORDER BY l.created_at DESC
    `).all(...params);

    allLogs.forEach(log => {
        const row = detailSheet.addRow({
            datetime: new Date(log.created_at).toLocaleString('tr-TR'),
            code: log.username,
            name: log.full_name,
            action: log.action,
            ip: log.ip_address || '-'
        });

        row.eachCell(cell => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });

        // Giriş: yeşil, Çıkış: kırmızı
        if (log.action === 'Giriş Yaptı') {
            row.getCell(4).font = { color: { argb: 'FF059669' }, bold: true };
        } else {
            row.getCell(4).font = { color: { argb: 'FFDC2626' }, bold: true };
        }
    });

    const fileName = `giris_cikis_raporu_${Date.now()}.xlsx`;
    const filePath = path.join(REPORTS_DIR, fileName);
    await workbook.xlsx.writeFile(filePath);

    return { fileName, filePath };
}

// ==================== OTOMATİK TEMİZLİK ====================

// 1 günden eski raporları sil
function cleanOldReports() {
    if (!fs.existsSync(REPORTS_DIR)) return;
    
    fs.readdir(REPORTS_DIR, (err, files) => {
        if (err) return console.error('Rapor dizini okunamadı:', err);
        
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        
        files.forEach(file => {
            const filePath = path.join(REPORTS_DIR, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                
                // 1 günden eskiyse sil
                if (now - stats.mtimeMs > ONE_DAY) {
                    fs.unlink(filePath, err => {
                        if (!err) console.log(`✓ Eski rapor silindi: ${file}`);
                    });
                }
            });
        });
    });
}

// Şeflik Performans Raporu (Excel)
async function generateSefPerformanceExcel() {
    ensureReportsDir();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Elbistan İlçe MEM';
    workbook.created = new Date();

    // ── SAYFA 1: Şef Özet ──
    const summarySheet = workbook.addWorksheet('Şeflik Özeti');

    // Başlık
    summarySheet.mergeCells('A1:I1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'ŞEFLİK PERFORMANS RAPORU';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFE31E24' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 35;

    summarySheet.mergeCells('A2:I2');
    const dateCell = summarySheet.getCell('A2');
    dateCell.value = `Rapor Tarihi: ${formatDate(new Date())}`;
    dateCell.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
    dateCell.alignment = { horizontal: 'center' };

    // Tablo başlıkları
    const headerRow = 4;
    const headers = [
        'Şef Adı', 'Kullanıcı Adı', 'Toplam Görev', 'Toplam Atama',
        'Tamamlanan', 'Onay Bekleyen', 'İade Edilen', 'Bekleyen',
        'Başarı Oranı (%)'
    ];

    summarySheet.columns = [
        { key: 'name', width: 30 },
        { key: 'username', width: 18 },
        { key: 'taskCount', width: 14 },
        { key: 'totalAssign', width: 14 },
        { key: 'completed', width: 14 },
        { key: 'pendingApproval', width: 16 },
        { key: 'rejected', width: 14 },
        { key: 'pending', width: 14 },
        { key: 'rate', width: 16 }
    ];

    const hRow = summarySheet.getRow(headerRow);
    headers.forEach((h, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' }
        };
    });
    hRow.height = 28;

    // Şefleri getir
    const sefs = db.prepare("SELECT * FROM users WHERE role = 'sef' ORDER BY full_name ASC").all();

    let grandTotalTasks = 0, grandTotalAssign = 0, grandCompleted = 0;
    let grandPendingApproval = 0, grandRejected = 0, grandPending = 0;

    sefs.forEach((sef, idx) => {
        const tasks = db.prepare('SELECT * FROM tasks WHERE created_by = ?').all(sef.id);
        const taskIds = tasks.map(t => t.id);

        let totalAssign = 0, completed = 0, pendingApproval = 0, rejected = 0, pending = 0;

        if (taskIds.length > 0) {
            const placeholders = taskIds.map(() => '?').join(',');
            const assignments = db.prepare(`SELECT * FROM task_assignments WHERE task_id IN (${placeholders})`).all(...taskIds);
            totalAssign = assignments.length;
            completed = assignments.filter(a => a.status === 'completed').length;
            pendingApproval = assignments.filter(a => a.status === 'pending_approval').length;
            rejected = assignments.filter(a => a.status === 'rejected').length;
            pending = assignments.filter(a => a.status === 'pending' || a.status === 'in_progress').length;
        }

        const rate = totalAssign > 0 ? Math.round((completed / totalAssign) * 100) : 0;

        grandTotalTasks += tasks.length;
        grandTotalAssign += totalAssign;
        grandCompleted += completed;
        grandPendingApproval += pendingApproval;
        grandRejected += rejected;
        grandPending += pending;

        const row = summarySheet.addRow({
            name: sef.full_name,
            username: sef.username,
            taskCount: tasks.length,
            totalAssign,
            completed,
            pendingApproval,
            rejected,
            pending,
            rate
        });

        // Zebra renklendirme
        if (idx % 2 === 0) {
            row.eachCell({ includeEmpty: true }, cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            });
        }

        // Kenarlık
        row.eachCell({ includeEmpty: true }, cell => {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
        // İsim sola hizalı
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

        // Başarı oranına göre renk
        const rateCell = row.getCell(9);
        if (rate >= 80) {
            rateCell.font = { bold: true, color: { argb: 'FF059669' } };
            rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        } else if (rate >= 50) {
            rateCell.font = { bold: true, color: { argb: 'FFD97706' } };
            rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
        } else if (rate > 0) {
            rateCell.font = { bold: true, color: { argb: 'FFDC2626' } };
            rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
        }
    });

    // Toplam satırı
    const totalRow = summarySheet.addRow({
        name: 'TOPLAM',
        username: '',
        taskCount: grandTotalTasks,
        totalAssign: grandTotalAssign,
        completed: grandCompleted,
        pendingApproval: grandPendingApproval,
        rejected: grandRejected,
        pending: grandPending,
        rate: grandTotalAssign > 0 ? Math.round((grandCompleted / grandTotalAssign) * 100) : 0
    });
    totalRow.eachCell({ includeEmpty: true }, cell => {
        cell.font = { bold: true, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'medium' }, bottom: { style: 'medium' },
            left: { style: 'thin' }, right: { style: 'thin' }
        };
    });
    totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    // ── SAYFA 2: Görev Bazlı Detay ──
    const detailSheet = workbook.addWorksheet('Görev Detayları');

    detailSheet.columns = [
        { key: 'sefName', width: 25 },
        { key: 'taskTitle', width: 40 },
        { key: 'deadline', width: 14 },
        { key: 'totalAssign', width: 14 },
        { key: 'completed', width: 14 },
        { key: 'pendingApproval', width: 16 },
        { key: 'rejected', width: 14 },
        { key: 'pending', width: 14 },
        { key: 'rate', width: 14 },
        { key: 'status', width: 14 }
    ];

    detailSheet.mergeCells('A1:J1');
    const dtTitle = detailSheet.getCell('A1');
    dtTitle.value = 'ŞEFLİK GÖREV DETAY RAPORU';
    dtTitle.font = { bold: true, size: 14, color: { argb: 'FF1E40AF' } };
    dtTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    detailSheet.getRow(1).height = 30;

    const dHeaders = [
        'Şef Adı', 'Görev Başlığı', 'Son Tarih', 'Toplam Atama',
        'Tamamlanan', 'Onay Bekl.', 'İade', 'Bekleyen', 'Oran (%)', 'Durum'
    ];

    const dhRow = detailSheet.getRow(3);
    dHeaders.forEach((h, i) => {
        const cell = dhRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' }
        };
    });
    dhRow.height = 26;

    sefs.forEach(sef => {
        const tasks = db.prepare('SELECT * FROM tasks WHERE created_by = ? ORDER BY created_at DESC').all(sef.id);

        tasks.forEach(task => {
            const assignments = db.prepare('SELECT * FROM task_assignments WHERE task_id = ?').all(task.id);
            const total = assignments.length;
            const completed = assignments.filter(a => a.status === 'completed').length;
            const pApproval = assignments.filter(a => a.status === 'pending_approval').length;
            const rej = assignments.filter(a => a.status === 'rejected').length;
            const pend = assignments.filter(a => a.status === 'pending' || a.status === 'in_progress').length;
            const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

            const isExpired = task.deadline && new Date(task.deadline) < new Date();
            const taskStatus = isExpired ? 'Süresi Doldu' : 'Aktif';

            const row = detailSheet.addRow({
                sefName: sef.full_name,
                taskTitle: task.title,
                deadline: formatDate(task.deadline),
                totalAssign: total,
                completed,
                pendingApproval: pApproval,
                rejected: rej,
                pending: pend,
                rate,
                status: taskStatus
            });

            row.eachCell({ includeEmpty: true }, cell => {
                cell.alignment = { vertical: 'middle', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            });

            // Durum rengi
            const statusCell = row.getCell(10);
            if (isExpired) {
                statusCell.font = { bold: true, color: { argb: 'FFDC2626' } };
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
            } else {
                statusCell.font = { bold: true, color: { argb: 'FF059669' } };
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
            }
        });
    });

    const fileName = `seflik_performans_${Date.now()}.xlsx`;
    const filePath = path.join(REPORTS_DIR, fileName);
    await workbook.xlsx.writeFile(filePath);

    return { fileName, filePath };
}

// Günde bir kez çalıştır (ve başlatırken)
setInterval(cleanOldReports, 24 * 60 * 60 * 1000);
setTimeout(cleanOldReports, 5000); // Başlangıçtan 5 saniye sonra ilk temizlik

module.exports = {
    generateTaskSummaryExcel,
    generateSchoolPerformanceExcel,
    generateSchoolPerformancePDF,
    generateTaskDetailExcel,
    generateTaskSummaryPDF,
    generateLoginActivityExcel,
    generateSefPerformanceExcel,
    cleanOldReports,
    REPORTS_DIR
};
