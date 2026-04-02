const request = require('supertest');
const app = require('../server');

describe('Temel Rota Testleri', () => {
    it('kök dizin /login sayfasına yönlendirmelidir', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toEqual(302);
        expect(res.header.location).toBe('/login');
    });

    it('/login sayfası sorunsuz yüklenmelidir', async () => {
        const res = await request(app).get('/login');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Giriş Yap');
    });

    it('kimlik doğrulama olmadan /admin/tasks sayfasına girilememelidir (302 redirect)', async () => {
        const res = await request(app).get('/admin/tasks');
        expect(res.statusCode).toEqual(302);
        expect(res.header.location).toBe('/login');
    });
});
