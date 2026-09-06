const CACHE="mahoumerge-v7";
const ASSETS=["./","./index.html","./styles.css","./game.js","./manifest.json","./icon.svg","./assets/girl_1.png","./assets/girl_2.png","./assets/girl_3.png","./assets/enemy_1.png","./assets/enemy_2.png","./assets/enemy_3.png","./assets/enemy_4.png","./assets/enemy_5.png","./assets/enemy_6.png","./assets/enemy_7.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",event=>{event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match("./index.html"))) )});
