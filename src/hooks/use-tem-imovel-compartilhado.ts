import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'

/**
 * Detecta se o usuário atual tem imóveis compartilhados com ele
 * (dono Premium não precisa disso — já tem acesso total).
 *
 * A regra "list" da coleção `imoveis` já devolve só o que é dono OU
 * compartilhado; para não-Premium, tudo que volta é compartilhado.
 * Resultado é cacheado no módulo para a BottomNav não refazer a chamada.
 */
let cache: boolean | null = null

export const useTemImovelCompartilhado = (): boolean => {
  const { user, plan } = useAuth()
  const [tem, setTem] = useState<boolean>(plan === 'premium' || cache === true)

  useEffect(() => {
    if (plan === 'premium') {
      setTem(true)
      return
    }
    if (!user?.id) {
      setTem(false)
      return
    }
    if (cache !== null) {
      setTem(cache)
      return
    }
    let ativo = true
    void pb
      .collection('imoveis')
      .getList(1, 1, { filter: `user_id != "${user.id}"` })
      .then((r) => {
        cache = r.totalItems > 0
        if (ativo) setTem(cache)
      })
      .catch(() => {
        if (ativo) setTem(false)
      })
    return () => {
      ativo = false
    }
  }, [user?.id, plan])

  return tem
}

/** Invalida o cache (chamar depois de compartilhar/descompartilhar). */
export const invalidarCacheImovelCompartilhado = () => {
  cache = null
}
