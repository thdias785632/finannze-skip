import React, { useEffect, useState } from 'react'
import { Users, Percent, Loader2 } from 'lucide-react'
import { gruposService } from '@/services/grupos'
import type { MembroGrupo } from '@/services/grupos'
import pb from '@/lib/pocketbase/client'
import { formatBRLPublic } from '@/lib/format'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'

/** Uma linha do seletor: quanto do valor da transação vai para a pessoa. */
export interface DivisaoMembro {
  user_id: string
  valor: number
}

interface DivisaoGrupoProps {
  /** Valor total da transação (o que sobra fica com o dono). */
  valorTotal: number
  /** Divisões já gravadas (edição) ou nada (nova transação). */
  iniciais?: DivisaoMembro[]
  /** Divisão atual (controlado) — quanto vai para cada pessoa. */
  valor: DivisaoMembro[]
  onChange: (divisao: DivisaoMembro[]) => void
}

/**
 * Seletor de divisão da transação entre membros dos grupos do usuário.
 * Aparece só quando o usuário participa de ao menos um grupo com outra
 * pessoa aceita. A soma por pessoa é livre — o que sobrar fica com o dono.
 */
export const DivisaoGrupo: React.FC<DivisaoGrupoProps> = ({
  valorTotal,
  iniciais,
  valor,
  onChange,
}) => {
  const [membros, setMembros] = useState<MembroGrupo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ativo, setAtivo] = useState(valor.length > 0)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const ms = await gruposService.meusMembros()
        if (vivo) setMembros(ms)
      } catch {
        if (vivo) setMembros([])
      } finally {
        if (vivo) setCarregando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  // Quando desliga a divisão, limpa tudo.
  const alternar = (ligado: boolean) => {
    setAtivo(ligado)
    if (!ligado) onChange([])
  }

  // Liga automaticamente quando carrega com divisão já gravada (edição).
  useEffect(() => {
    if (!carregando && valor.length > 0) setAtivo(true)
  }, [carregando, valor.length])

  /** Liga/divide igualmente entre todos os membros (o dono fica com o resto). */
  const dividirIgual = () => {
    if (membros.length === 0 || valorTotal <= 0) return
    const parte = Math.floor((valorTotal / membros.length) * 100) / 100
    onChange(membros.map((m) => ({ user_id: m.user_id, valor: parte })))
  }

  const setValor = (user_id: string, v: number) => {
    onChange(valor.map((d) => (d.user_id === user_id ? { ...d, valor: v } : d)))
  }

  const alternarMembro = (user_id: string, ligado: boolean) => {
    if (ligado) {
      const parte = Math.floor((valorTotal / (valor.length + 1)) * 100) / 100
      onChange([...valor, { user_id, valor: parte }])
    } else {
      onChange(valor.filter((d) => d.user_id !== user_id))
    }
  }

  const totalDividido = valor.reduce((s, d) => s + (d.valor || 0), 0)
  const restante = Math.max(0, valorTotal - totalDividido)
  const excede = totalDividido > valorTotal + 0.009

  const meuNome = String(pb.authStore.record?.name || pb.authStore.record?.email || 'Eu')

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6639A6]" />
        Carregando grupo…
      </div>
    )
  }

  // Sem grupo com outra pessoa aceita: nada a mostrar.
  if (membros.length === 0) return null

  return (
    <div className="rounded-2xl border border-[#EBE4F5] bg-[#F9F6FD] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[#6639A6]" />
          Dividir entre o grupo
        </p>
        <Switch checked={ativo} onCheckedChange={alternar} aria-label="Dividir entre o grupo" />
      </div>

      {ativo && (
        <>
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>Total do lançamento: {formatBRLPublic(valorTotal)}</span>
            <button
              type="button"
              onClick={dividirIgual}
              className="font-bold text-[#6639A6] hover:underline flex items-center gap-1"
            >
              <Percent className="w-3 h-3" />
              Dividir igualmente
            </button>
          </div>

          <ul className="space-y-2">
            {membros.map((m) => {
              const selecionado = valor.some((d) => d.user_id === m.user_id)
              const valorMembro = valor.find((d) => d.user_id === m.user_id)?.valor ?? 0
              return (
                <li key={m.user_id} className="bg-white rounded-xl border border-[#EBE4F5] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                      <Switch
                        checked={selecionado}
                        onCheckedChange={(v) => alternarMembro(m.user_id, v)}
                        aria-label={`Dividir com ${m.nome || m.email}`}
                      />
                      <span className="text-xs font-semibold text-[#1F1438] truncate">
                        {m.nome || m.email}
                      </span>
                    </label>
                    {selecionado && (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-gray-400">R$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={valorMembro || ''}
                          onChange={(e) => setValor(m.user_id, Number(e.target.value) || 0)}
                          className="w-24 h-8 px-2 rounded-lg border border-gray-200 text-xs text-right text-[#1F1438] focus:outline-none focus:ring-2 focus:ring-[#6639A6]/30 focus:border-[#6639A6]"
                        />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="text-[11px] text-gray-500 flex items-center justify-between">
            <span>
              Dividido: <strong className="text-[#1F1438]">{formatBRLPublic(totalDividido)}</strong>
              {excede
                ? ' — maior que o valor do lançamento'
                : ` — ${formatBRLPublic(restante)} fica com você (${meuNome})`}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

/** Toast de erro padrão quando a divisão informada não fecha. */
export const validarDivisao = (valorTotal: number, divisao: DivisaoMembro[]): string | null => {
  if (divisao.length === 0) return null
  const total = divisao.reduce((s, d) => s + (d.valor || 0), 0)
  if (total > valorTotal + 0.009) {
    return 'A soma da divisão é maior que o valor do lançamento'
  }
  if (divisao.some((d) => d.valor <= 0)) {
    return 'Informe um valor maior que zero para cada pessoa da divisão'
  }
  return null
}

/** Hook utilitário: carrega os membros do grupo uma vez e devolve estado. */
export const useMembrosGrupo = () => {
  const [membros, setMembros] = useState<MembroGrupo[]>([])
  const [carregando, setLoading] = useState(true)
  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const ms = await gruposService.meusMembros()
        if (vivo) setMembros(ms)
      } catch {
        if (vivo) setMembros([])
      } finally {
        if (vivo) setLoading(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [])
  return { membros, carregando }
}
