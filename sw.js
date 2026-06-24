const CACHE_NAME = 'naisargik-admin-cache-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html'
    // আপনি চাইলে এখানে আরও লোকাল ছবি বা সিএসএস ফাইলের পাথ যুক্ত করতে পারেন
];

// Install Event - স্ট্যাটিক ফাইলগুলো ক্যাশ করা হবে
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching App Shell');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event - পুরোনো ক্যাশ ডিলিট করে নতুন ভার্সন আপডেট করা হবে
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing Old Cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - ক্যাশ থেকে লোড করা বা নেটওয়ার্ক থেকে আনা
self.addEventListener('fetch', (event) => {
    const requestUrl = event.request.url;

    // ফায়ারবেস ডেটাবেস, অথেনটিকেশন এবং ImgBB API-এর লাইভ ডেটা ক্যাশ হওয়া থেকে বিরত রাখা
    if (
        requestUrl.includes('firestore.googleapis.com') ||
        requestUrl.includes('identitytoolkit.googleapis.com') ||
        requestUrl.includes('api.imgbb.com')
    ) {
        return; // এগুলো সরাসরি ইন্টারনেট থেকে লোড হবে
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // যদি ক্যাশে ফাইল থাকে, তাহলে ক্যাশ থেকে রিটার্ন করবে
            if (cachedResponse) {
                return cachedResponse;
            }

            // ক্যাশে না থাকলে নেটওয়ার্ক থেকে আনবে এবং ডাইনামিক ক্যাশে সেভ করবে (CDN এর জন্য)
            return fetch(event.request).then((networkResponse) => {
                // শুধুমাত্র ভ্যালিড GET রিকোয়েস্ট ক্যাশ করা হবে
                if (
                    event.request.method === 'GET' && 
                    !requestUrl.startsWith('chrome-extension') &&
                    networkResponse.status === 200
                ) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // ইউজার অফলাইনে থাকলে এবং কোনো ফাইল ক্যাশে না পেলে যা হবে (অপশনাল)
                console.log('[Service Worker] You are offline and resource is not cached.');
            });
        })
    );
});