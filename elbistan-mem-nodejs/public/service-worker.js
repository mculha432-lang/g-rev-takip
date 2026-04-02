const CACHE = 'v4';

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(c => {
            return c.addAll(['/login']);
        }).catch(err => console.log('Cache error:', err))
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE) return caches.delete(key);
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    if (!e.request.url.startsWith('http')) return;
    if (e.request.url.includes('/push/') || e.request.url.includes('/api/')) return;

    // DÜZELTME: Dış kaynak isteklerini (wikipedia vb.) önbellekleme — 404 hatasını önler
    const url = new URL(e.request.url);
    if (url.origin !== self.location.origin) return;

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
            .catch(() => caches.match(e.request))
    );
});

self.addEventListener('push', e => {
    let payload = {
        title: 'E-GTS Bildirim',
        body: 'Yeni bir bildiriminiz var.',
        icon: '/icons/mem-logo.jpg',
        url: '/',
        tag: 'general'
    };

    try {
        if (e.data) {
            const data = e.data.json();
            payload = { ...payload, ...data };
        }
    } catch (err) {
        try {
            if (e.data) payload.body = e.data.text();
        } catch (e2) {
            console.error('Push data parse error:', err);
        }
    }

    const options = {
        body: payload.body,
        icon: payload.icon || '/icons/mem-logo.jpg',
        badge: '/icons/mem-logo.jpg',
        image: payload.image || undefined,
        vibrate: [200, 100, 200, 100, 200],
        tag: payload.tag || 'egts-notification',
        renotify: true,
        requireInteraction: true,
        silent: false,
        data: {
            url: payload.url || '/',
            timestamp: Date.now()
        },
        actions: payload.actions || [
            { action: 'open',    title: '📂 Aç'   },
            { action: 'dismiss', title: '✕ Kapat' }
        ]
    };

    e.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

self.addEventListener('notificationclick', e => {
    e.notification.close();

    const action = e.action;
    const notificationData = e.notification.data || {};
    const targetUrl = notificationData.url || '/';

    if (action === 'dismiss') return;

    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if (client.url.includes(self.registration.scope) && 'focus' in client) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }
                return self.clients.openWindow(targetUrl);
            })
    );
});

self.addEventListener('notificationclose', e => {
    console.log('[SW] Bildirim kapatıldı:', e.notification.tag);
});
