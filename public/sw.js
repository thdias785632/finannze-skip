/* Service worker do Finanzze: cache offline do shell e dos assets.
 * Nova versão: instala e assume o controle imediatamente; a página recarrega
 * (ver src/lib/pwa.ts), então o usuário recebe a versão publicada. */
const CACHE = 'finanzze-cache-v1'
const SHELL = ['/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Só o próprio site; chamadas à API e ao painel seguem direto para a rede
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/_')) return

  if (request.mode === 'navigate') {
    // Páginas: rede primeiro (pega versão nova); sem rede, usa o shell em cache
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copia = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/', copia))
          return response
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    )
    return
  }

  // Assets (nomes com hash do Vite e imagens): cache primeiro, rede como fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copia = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copia))
        }
        return response
      })
    }),
  )
})
