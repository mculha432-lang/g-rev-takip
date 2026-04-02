# Elbistan İlçe MEM - Görev Takip Sistemi

Elbistan İlçe Milli Eğitim Müdürlüğü kurumları arasında veri toplama, görev atama ve mesajlaşma süreçlerini yönetmek için geliştirilmiş Node.js tabanlı özel bir sistemdir.

## 🚀 Özellikler

- **Dinamik Görev Oluşturma**: Google Forms benzeri alan eklenebilir görev yapısı
- **Çoklu Dosya Yükleme**: Görevlere çoklu dosya teslim edebilme
- **Push Bildirimleri**: Kurum cihazlarına anlık web bildirimi
- **Detaylı Raporlama**: Görevler ve okul bazında Excel / PDF raporlama
- **Kurum İçi Mesajlaşma**: İade ve onay süreçlerinde mesajlaşma alt yapısı
- **Otomatik Yedekleme**: Her gece otomatik veritabanı ve dosya yedekleme
- **Rol Yönetimi**: Admin ve Okul Yöneticisi rolleri.

## 🛠️ Kurulum

### Yöntem 1: Standart Node.js (Sunucu)
1. Repoyu klonlayın ve klasöre girin: `cd elbistan-mem-nodejs`
2. Bağımlılıkları yükleyin: `npm install`
3. `.env` dosyasını `SESSION_SECRET` belirleyerek oluşturun. (Örn: `SESSION_SECRET=cok-gizli-bir-sifre`)
4. Uygulamayı başlatın (Geliştirme): `npm run dev`
5. Uygulamayı başlatın (Production): `npm start`

### Yöntem 2: Docker ile Kullanım
Makinenizde Docker yüklü ise sadece şu komutla çalıştırabilirsiniz:
```bash
docker-compose up -d --build
```
Logları, veritabanını (`database/`) ve yüklenen dosyaları (`public/uploads`) dışarı bağlayarak (volume) kalıcı olmasını sağlar.

## 🔑 Varsayılan Giriş Bilgileri
**Admin Kullanıcısı:**
- **Kullanıcı adı**: `admin`
- **Şifre**: `admin123`

*(🚨 İlk kurulumdan sonra lütfen bu şifreyi admin panelden değiştirin!)*

## 📂 Dizin Yapısı
- `config/` - Veritabanı ve konfigürasyon dosyaları.
- `controllers/` - İstekleri karşılayan mantıksal kontrolcüler.
- `routes/` - Express route yönlendirmeleri.
- `views/` - EJS şablon (önyüz) dosyaları.
- `utils/` - Yedekleme, push bildirimi, loglama, dosya yükleme, deadline hesaplama vb. yardımcı fonksiyonlar.
- `public/` - Dışarıya açık CSS, JS, upload edilen belgeler ve raporlar.
- `database/` - SQLite3 veritabanı dosyasına ev sahipliği yapar.

## 🔒 Güvenlik
- Şifreler `bcrypt` ile güçlendirilip saklanır.
- Formlarda `csurf` paketine dayalı CSRF koruması mevcuttur.
- Brute-force saldırılarına karşı `express-rate-limit` ile login limiti ayarlanmıştır.
- `helmet` ile standart HTTP güvenlik başlıkları eklenir.
