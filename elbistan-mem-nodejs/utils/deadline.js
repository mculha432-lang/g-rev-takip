/**
 * Deadline Utility - Görev süre kontrolü
 * Tüm controller ve view'larda tekrar eden deadline kontrolünü merkezileştirir
 */

/**
 * Görev deadline'ının geçip geçmediğini kontrol eder
 * @param {string|null} deadline - Görev son teslim tarihi (YYYY-MM-DD veya ISO)
 * @returns {boolean} - true: süre dolmuş, false: hâlâ aktif
 */
function isDeadlinePassed(deadline) {
    if (!deadline) return false;

    const now = new Date();
    const deadlineDate = new Date(deadline);

    // Sadece tarih formatı gelirse (YYYY-MM-DD), günün sonuna ayarla
    if (deadline.length <= 10) {
        deadlineDate.setHours(23, 59, 59, 999);
    }

    return now > deadlineDate;
}

/**
 * Deadline'a kalan gün sayısını hesaplar
 * @param {string|null} deadline - Görev son teslim tarihi
 * @returns {number} - Kalan gün (negatif = geçmiş)
 */
function daysUntilDeadline(deadline) {
    if (!deadline) return Infinity;

    const now = new Date();
    const deadlineDate = new Date(deadline);
    if (deadline.length <= 10) {
        deadlineDate.setHours(23, 59, 59, 999);
    }

    const diffMs = deadlineDate - now;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Görevin gönderilebilir olup olmadığını kontrol eder
 * @param {string|null} deadline - Görev son teslim tarihi
 * @param {string} status - Atama durumu (pending, in_progress, completed, rejected)
 * @returns {boolean} - true: gönderilebilir
 */
function canSubmitResponse(deadline, status) {
    // Tamamlanmış görevler gönderilemez
    if (status === 'completed') return false;

    // İade edilmiş görevler deadline geçse bile gönderilebilir
    if (status === 'rejected') return true;

    // Deadline geçmişse gönderilemez
    if (isDeadlinePassed(deadline)) return false;

    return true;
}

module.exports = {
    isDeadlinePassed,
    daysUntilDeadline,
    canSubmitResponse
};
