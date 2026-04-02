FROM node:18-alpine

# Çalışma dizini
WORKDIR /app

# Paket dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle (bcrypt gibi C++ modülleri için build araçları gerekebilir)
RUN apk add --no-cache make gcc g++ python3 && \
    npm install && \
    apk del make gcc g++ python3

# Uygulama kodunu kopyala
COPY . .

# Veritabanı, loglar ve yüklenen dosyalar için klasörleri oluştur
RUN mkdir -p database logs backups public/uploads/responses public/uploads/tasks public/reports

# İzinleri ayarla
RUN chmod -R 777 database logs backups public/uploads public/reports

# Portu aç
EXPOSE 3000

# Uygulamayı başlat
CMD ["npm", "start"]
