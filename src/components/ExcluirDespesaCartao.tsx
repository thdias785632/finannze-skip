import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { transacoesService } from '@/services/transacoes'
import type { Transacao } from '@/types/financial'
import { Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

/**
 * Exclusão de despesa de cartão.
 *
 * - Sem parcelas (serie_id vazio): confirmação simples (confirm) e exclui só
 *   aquele lançamento.
 * - Com parcelas: dialog de escolha — "Excluir todas as parcelas" (remove a
 *   série inteira, todos os lançamentos com o mesmo serie_id) ou "Excluir só
 *   esta" (remove APENAS o lançamento clicado; as demais parcelas da série
 *   ficam intocadas, cada uma no seu mês de fatura — nada é recalculado ou
 *   renomeado, os sufixos "(k/n)" continuam como estão).
 */

/** Resultado do clique na lixeira, para o consumidor saber o que fazer. */
export type PedidoExclusao =
  | { tipo: 'dialog'; transacao: Transacao }
  | { tipo: 'excluida'; ids: string[] }

/**
 * Ponto de entrada do fluxo: decide entre confirmação simples (lançamento
 * único) e dialog de escolha (série). O consumidor trata o resultado —
 * exclui direto no caso 'excluida' ou guarda a transação e abre o dialog.
 */
export const pedirExclusaoDespesaCartao = async (transacao: Transacao): Promise<PedidoExclusao> => {
  if (transacao.serie_id) {
    return { tipo: 'dialog', transacao }
  }
  if (!confirm(`Excluir a despesa "${transacao.descricao}"?`)) {
    return { tipo: 'excluida', ids: [] }
  }
  try {
    const ids = await transacoesService.excluir(transacao, 'uma')
    toast({ title: 'Despesa excluída' })
    return { tipo: 'excluida', ids }
  } catch {
    toast({
      variant: 'destructive',
      title: 'Erro ao excluir',
      description: 'Não foi possível excluir a despesa.',
    })
    return { tipo: 'excluida', ids: [] }
  }
}

export const ExcluirDespesaCartaoDialog: React.FC<{
  transacao: Transacao | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chamada após excluir, com os ids removidos (1 no escopo "só esta"). */
  onExcluidas: (ids: string[]) => void
}> = ({ transacao, open, onOpenChange, onExcluidas }) => {
  const [excluindo, setExcluindo] = useState(false)

  if (!transacao) return null

  const excluir = async (escopo: 'uma' | 'todas') => {
    if (!transacao) return
    setExcluindo(true)
    try {
      const ids = await transacoesService.excluir(transacao, escopo)
      onOpenChange(false)
      onExcluidas(ids)
      toast({
        title: escopo === 'todas' ? 'Despesa excluída' : 'Parcela excluída',
        description:
          escopo === 'todas'
            ? 'Todas as parcelas da série foram removidas.'
            : 'As demais parcelas permanecem nos seus meses.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a despesa.',
      })
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border border-[#EBE4F5] bg-white p-5 shadow-[0_4px_24px_rgba(102,57,166,0.15)]">
        <DialogHeader>
          <DialogTitle className="text-sm font-black text-[#1F1438] flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            Excluir despesa parcelada
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-gray-600 mt-1">
          "{transacao.descricao}" é uma compra parcelada. O que deseja excluir?
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={excluindo}
            onClick={() => void excluir('todas')}
            className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold py-3 rounded-xl transition-colors"
          >
            {excluindo ? 'Excluindo…' : 'Excluir todas as parcelas'}
          </button>
          <button
            type="button"
            disabled={excluindo}
            onClick={() => void excluir('uma')}
            className="w-full bg-[#6639A6] hover:bg-[#4A247A] disabled:opacity-60 text-white text-xs font-bold py-3 rounded-xl transition-colors"
          >
            {excluindo ? 'Excluindo…' : 'Excluir só esta'}
          </button>
          <button
            type="button"
            disabled={excluindo}
            onClick={() => onOpenChange(false)}
            className="w-full text-xs font-semibold text-gray-500 hover:text-gray-700 py-2 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
