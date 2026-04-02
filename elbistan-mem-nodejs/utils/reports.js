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
    sheet.addRow(['Görev Bilgileri']);
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.addRow(['Görev Adı:', task.title]);
    sheet.addRow(['Açıklama:', task.description || '-']);
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

        // Satır verileri
        const rowData = [
            a.full_name,
            a.username,
            translateStatus(a.status),
            a.is_read ? 'Evet' : 'Hayır',
            a.response_note || '-',
            a.response_file || '-'
        ];

        // Form alanı cevaplarını ekle
        taskFields.forEach(field => {
            rowData.push(responseMap[field.id] || '-');
        });

        const row = sheet.addRow(rowData);

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

    sheet.addRow(['Toplam Atama:', totalAssignments]);
    sheet.addRow(['Tamamlanan:', completedCount]);
    sheet.addRow(['İşlemde:', inProgressCount]);
    sheet.addRow(['Bekleyen:', pendingCount]);
    sheet.addRow(['Tamamlanma Oranı:', totalAssignments > 0 ? `%${Math.round(completedCount / totalAssignments * 100)}` : '%0']);

    const fileName = `gorev_${taskId}_detay_${Date.now()}.xlsx`;
    const filePath = path.join(REPORTS_DIR, fileName);
    await workbook.xlsx.writeFile(filePath);

    return { fileName, filePath };
}

// ==================== PDF RAPORLARI ====================

// Görev Özet PDF
async function generateTaskSummaryPDF() {
    ensureReportsDir();

    return new Promise((resolve, reject) => {
        const fileName = `gorev_ozeti_${Date.now()}.pdf`;
        const filePath = path.join(REPORTS_DIR, fileName);

        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Türkçe karakter desteği için Arial font
        const fontPath = path.join(__dirname, '..', 'fonts', 'arial.ttf');
        const fontBoldPath = path.join(__dirname, '..', 'fonts', 'arialbd.ttf');

        doc.registerFont('Arial', fontPath);
        doc.registerFont('Arial-Bold', fontBoldPath);
        doc.font('Arial');

        // Başlık
        doc.font('Arial-Bold').fontSize(20).text('Elbistan İlçe Milli Eğitim Müdürlüğü', { align: 'center' });
        doc.font('Arial').fontSize(16).text('Görev Özet Raporu', { align: 'center' });
        doc.fontSize(10).text(`Oluşturulma: ${new Date().toLocaleString('tr-TR')}`, { align: 'center' });
        doc.moveDown(2);

        // İstatistikler
        const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
        const totalAssignments = db.prepare('SELECT COUNT(*) as count FROM task_assignments').get().count;
        const completedAssignments = db.prepare("SELECT COUNT(*) as count FROM task_assignments WHERE status = 'completed'").get().count;
        const successRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

        doc.font('Arial').fontSize(12);
        doc.text(`Toplam Görev: ${totalTasks}`);
        doc.text(`Toplam Atama: ${totalAssignments}`);
        doc.text(`Tamamlanan: ${completedAssignments}`);
        doc.text(`Genel Başarı Oranı: %${successRate}`);
        doc.moveDown(2);

        // Görev listesi
        doc.font('Arial-Bold').fontSize(14).text('Görevler', { underline: true });
        doc.moveDown();

        const tasks = db.prepare('SELECT * FROM tasks ORDER BY id DESC LIMIT 20').all();

        tasks.forEach((task, index) => {
            const assignments = db.prepare('SELECT * FROM task_assignments WHERE task_id = ?').all(task.id);
            const completed = assignments.filter(a => a.status === 'completed').length;

            doc.font('Arial-Bold').fontSize(11).text(`${index + 1}. ${task.title}`);
            doc.font('Arial').fontSize(9).text(`   Son Tarih: ${formatDate(task.deadline)} | Tamamlanan: ${completed}/${assignments.length}`);
            doc.moveDown(0.5);
        });

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

// Günde bir kez çalıştır (ve başlatırken)
setInterval(cleanOldReports, 24 * 60 * 60 * 1000);
setTimeout(cleanOldReports, 5000); // Başlangıçtan 5 saniye sonra ilk temizlik

module.exports = {
    generateTaskSummaryExcel,
    generateSchoolPerformanceExcel,
    generateTaskDetailExcel,
    generateTaskSummaryPDF,
    generateLoginActivityExcel,
    cleanOldReports,
    REPORTS_DIR
};
