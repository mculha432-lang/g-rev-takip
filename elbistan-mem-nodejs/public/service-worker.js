const CACHE = 'v3';

// ===== SERVICE WORKER: INSTALL =====
self.addEventListener('install', e => {
    self.skipWaiting(); // Yeni SW'yi hemen aktif et
    e.waitUntil(
        caches.open(CACHE).then(c => {
            return c.addAll(['/login']);
        }).catch(err => console.log('Cache error:', err))
    );
});

// ===== SERVICE WORKER: ACTIVATE =====
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
        }).then(() => self.clients.claim()) // Tüm sekmelerin kontrolünü al
    );
});

// ===== FETCH: Önbellek Stratejisi =====
self.addEventListener('fetch', e => {
    // Sadece GET isteklerini önbellekle
    if (e.request.method !== 'GET') return;

    // Yalnızca http/https şemalarını işleme al
    if (!e.request.url.startsWith('http')) return;

    // Push/API isteklerini önbellekleme (bildirimlerin çalışmasını engelleyebilir)
    if (e.request.url.includes('/push/') || e.request.url.includes('/api/')) return;

    e.respondWith(
        fetch(e.request)
            .then(response => {
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
                return caches.match(e.request);
            })
    );
});

// ===== PUSH NOTIFICATION: Anlık Bildirim Yakalayıcı =====
// Bu event uygulama KAPALI olsa bile çalışır (Android Chrome'da)
self.addEventListener('push', e => {
    let payload = {
        title: 'E-GTS Bildirim',
        body: 'Yeni bir bildiriminiz var.',
        icon: '/icons/icon-192.png',
        url: '/',
        tag: 'general'
    };

    try {
        if (e.data) {
            const data = e.data.json();
            payload = { ...payload, ...data };
        }
    } catch (err) {
        // text olarak dene
        try {
            if (e.data) {
                payload.body = e.data.text();
            }
        } catch (e2) {
            console.error('Push data parse error:', err);
        }
    }

    const options = {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        image: payload.image || undefined,
        vibrate: [200, 100, 200, 100, 200], // Daha belirgin titreşim
        tag: payload.tag || 'egts-notification', // Aynı tag'li bildirimler gruplanır
        renotify: true, // Aynı tag olsa bile yeniden bildir (ses/titreşim)
        requireInteraction: true, // Kullanıcı müdahale edene kadar kaybolmasın
        silent: false, // Ses çalsın
        data: {
            url: payload.url || '/',
            timestamp: Date.now()
        },
        actions: payload.actions || [
            { action: 'open', title: '📂 Aç' },
            { action: 'dismiss', title: '✕ Kapat' }
        ]
    };

    // waitUntil ile SW'nin push işlemi bitene kadar ayakta kalmasını sağla
    e.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// ===== NOTIFICATION CLICK: Bildirime Tıklanınca =====
self.addEventListener('notificationclick', e => {
    e.notification.close();

    const action = e.action;
    const notificationData = e.notification.data || {};
    const targetUrl = notificationData.url || '/';

    // "Kapat" aksiyonuna tıklandıysa sadece kapat
    if (action === 'dismiss') {
        return;
    }

    // Mevcut bir pencere/sekme varsa onu öne getir, yoksa yeni aç
    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // Zaten açık olan aynı origin'deki bir sekmeyi bul
                for (const client of clientList) {
                    if (client.url.includes(self.registration.scope) && 'focus' in client) {
                        // Mevcut sekmeyi hedef URL'ye yönlendir ve öne getir
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }
                // Hiç açık sekme yoksa yeni pencere aç
                return self.clients.openWindow(targetUrl);
            })
    );
});

// ===== NOTIFICATION CLOSE: Bildirim Kapatılınca (opsiyonel loglama) =====
self.addEventListener('notificationclose', e => {
    // İsteğe bağlı: Kapatılan bildirimleri logla
    console.log('[SW] Bildirim kapatıldı:', e.notification.tag);
});
