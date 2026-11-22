/* PWA: manifesto instalável, ícones e registro do service worker */
import appIcon from '@/assets/logo-192-8a6a4.png'

const THEME_COLOR = '#6639A6'
const BACKGROUND_COLOR = '#F6F3FB'

/**
 * Monta o manifesto em runtime (Blob URL) para que os ícones apontem para os
 * arquivos hasheados que o Vite gera a partir de src/assets.
 */
function instalarManifesto() {
  const origem = window.location.origin
  const icone = new URL(appIcon, origem).href
  const manifesto = {
    name: 'Quitafy',
    short_name: 'Quitafy',
    description: 'Controle de finanças pessoais',
    lang: 'pt-BR',
    start_url: `${origem}/`,
    scope: `${origem}/`,
    id: `${origem}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: icone, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icone, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    ],
  }
  const blob = new Blob([JSON.stringify(manifesto)], { type: 'application/manifest+json' })

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }
  link.href = URL.createObjectURL(blob)

  // Favicon e ícone de tela inicial (iOS) usam o mesmo logo
  for (const rel of ['icon', 'apple-touch-icon']) {
    let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (!el) {
      el = document.createElement('link')
      el.rel = rel
      document.head.appendChild(el)
    }
    el.type = 'image/png'
    el.href = appIcon
  }
}

/**
 * Registra o service worker (só em produção) e recarrega a página quando uma
 * versão nova assume o controle: a atualização acontece no próximo carregamento.
 */
function registrarServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  const temControleAntes = Boolean(navigator.serviceWorker.controller)
  let recarregando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!temControleAntes || recarregando) return
    recarregando = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* Sem service worker o app continua funcionando online */
    })
  })
}

export function iniciarPWA() {
  instalarManifesto()
  registrarServiceWorker()
}
