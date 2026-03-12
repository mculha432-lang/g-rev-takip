const CACHE = 'v1';

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(c => {
            // Önbelleklenecek sayfalar (Hata vermemesi için yönlendirme olmayan bir sayfa seçiyoruz)
            return c.addAll(['/login']);
        }).catch(err => console.log('Cache error:', err))
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
    // Sadece GET isteklerini önbellekle
    if (e.request.method !== 'GET') return;
    
    e.respondWith(
        fetch(e.request)
            .then(response => {
                // Sadece geçerli yanıtları önbelleğe al
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE).then(cache => {
                    cache.put(e.request, responseToCache);
                });
                return response;
            })
            .catch(() => {
                // İnternet yoksa veya sunucu çökerse önbellekten getir
                return caches.match(e.request);
            })
    );
});
