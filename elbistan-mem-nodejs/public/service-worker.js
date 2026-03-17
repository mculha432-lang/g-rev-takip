const CACHE = 'v2';

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
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => clients.claim())
    );
});

self.addEventListener('fetch', e => {
    // Sadece GET isteklerini önbellekle
    if (e.request.method !== 'GET') return;
    
    // Yalnızca http/https şemalarını işleme al, chrome-extension vb. istekleri doğrudan tarayıcıya bırak
    if (!e.request.url.startsWith('http')) return;
    
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

// Push notification (Anlık Bildirim) yakalayıcı
self.addEventListener('push', e => {
    let payload = { title: 'Yeni Bildirim', body: '', icon: '/icons/icon-192.png', url: '/' };
    try {
        if (e.data) {
            payload = e.data.json();
        }
    } catch (err) {
        console.error('Push data parse error:', err);
    }

    const options = {
        body: payload.body,
        icon: payload.icon,
        vibrate: [100, 50, 100],
        data: { url: payload.url },
        badge: '/icons/icon-192.png'
    };

    e.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// Bildirime tıklandığında aksiyon al
self.addEventListener('notificationclick', e => {
    e.notification.close();
    if (e.notification.data && e.notification.data.url) {
        e.waitUntil(
            clients.openWindow(e.notification.data.url)
        );
    } else {
        e.waitUntil(
            clients.openWindow('/')
        );
    }
});
