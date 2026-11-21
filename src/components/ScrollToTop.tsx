import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * A cada troca de rota, volta o scroll da janela (e de qualquer container de
 * scroll interno do app) para o topo — sem interferir quando um elemento é
 * roldado para a vista dentro da MESMA página (ex.: donut → detalhe).
 */
const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    document.querySelectorAll<HTMLElement>('[data-scroll-root]').forEach((el) => {
      el.scrollTop = 0
    })
  }, [pathname, search])

  return null
}

export default ScrollToTop
