const { isDeadlinePassed, daysUntilDeadline, canSubmitResponse } = require('../utils/deadline');

describe('Deadline Utility Functions', () => {
    
    // Geçmiş, Gelecek ve Şu anki zamanı manipüle edebilmek için yardımcı değişkenler
    const DUMMY_DATE = '2020-01-01';
    const FUTURE_DATE = '2080-01-01';

    test('isDeadlinePassed should return true for dates in the past', () => {
        expect(isDeadlinePassed(DUMMY_DATE)).toBe(true);
    });

    test('isDeadlinePassed should return false for dates in the future', () => {
        expect(isDeadlinePassed(FUTURE_DATE)).toBe(false);
    });

    test('isDeadlinePassed should return false if deadline is null', () => {
        expect(isDeadlinePassed(null)).toBe(false);
    });

    test('canSubmitResponse should return false if status is completed', () => {
        expect(canSubmitResponse(FUTURE_DATE, 'completed')).toBe(false);
    });

    test('canSubmitResponse should return true if status is rejected even if deadline passed', () => {
        expect(canSubmitResponse(DUMMY_DATE, 'rejected')).toBe(true);
    });

    test('canSubmitResponse should return false if deadline passed and status is pending', () => {
        expect(canSubmitResponse(DUMMY_DATE, 'pending')).toBe(false);
    });
});
