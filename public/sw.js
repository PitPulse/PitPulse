const CACHE_NAME = "pitpilot-v3";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/signup",
  "/join",
  "/offline.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Install: cache static shell + offline fallback
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches, claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: strategy varies by request type
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (POST scouting submissions, etc.)
  if (event.request.method !== "GET") return;

  // Skip API routes, auth routes, and Supabase calls — always network
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase.io")
  ) {
    return;
  }

  // Next.js static assets (/_next/static/): cache-first (immutable, hashed)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return response;
          })
      )
    );
    return;
  }

  // Navigation requests: network-first, fallback to offline.html.
  // Do not cache HTML navigations to avoid serving stale app shells after deploys.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // All other assets: cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(() => {
          // Return nothing for failed non-navigation requests
          return new Response("", { status: 503, statusText: "Offline" });
        })
    )
  );
});
