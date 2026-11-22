import React, { useState } from 'react'
import { X } from 'lucide-react'
import { imoveisService } from '@/services/imoveis'
import { gruposService, type MembroGrupo } from '@/services/grupos'
import { useAuth } from '@/context/AuthContext'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export const NovoImovelDialog: React.FC<Props> = ({ open, onClose, onSaved }) => {
  const { user } = useAuth()
  const [nome, setNome] = useState('')
  const [construtora, setConstrutora] = useState('')
  const [dataContrato, setDataContrato] = useState('')
  const [membros, setMembros] = useState<MembroGrupo[]>([])
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  React.useEffect(() => {
    if (!open) {
      return
    }
    void gruposService
      .meusMembros(user?.id)
      .then(setMembros)
      .catch(() => setMembros([]))
  }, [open, user?.id])

  // O valor NÃO é informado aqui: ele nasce da soma dos fluxos do imóvel.
  if (!open) return null

  const toggleMembro = (id: string) => setSelecionados((prev) => ({ ...prev, [id]: !prev[id] }))

  const salvar = async () => {
    if (!nome.trim()) {
      setErro('Informe o nome do imóvel')
      return
    }
    setSaving(true)
    setErro('')
    try {
      const hoje = new Date()
      const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
      const compartilhado = membros.filter((m) => selecionados[m.id]).map((m) => m.user_id)
      await imoveisService.create({
        nome: nome.trim(),
        construtora: construtora.trim() || undefined,
        // Valor opcional: passa a ser derivado dos fluxos (soma das parcelas).
        valor_original: undefined,
        data_contrato: dataContrato
          ? new Date(dataContrato + 'T12:00:00Z').toISOString()
          : undefined,
        mes_base_incc: mesAtual,
        defasagem_incc: 2,
        defasagem_meses: 2,
        compartilhado_com: compartilhado.length > 0 ? compartilhado : undefined,
      })
      setNome('')
      setConstrutora('')
      setDataContrato('')
      setSelecionados({})
      onSaved()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar imóvel')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1F1235]">Novo imóvel</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Nome do imóvel *</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Well Home - Living"
              className="w-full mt-1 rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] px-3 py-2.5 text-sm outline-none focus:border-[#6639A6]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Construtora</label>
            <input
              value={construtora}
              onChange={(e) => setConstrutora(e.target.value)}
              placeholder="Ex.: Cyrela"
              className="w-full mt-1 rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] px-3 py-2.5 text-sm outline-none focus:border-[#6639A6]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Data do contrato</label>
            <input
              type="date"
              value={dataContrato}
              onChange={(e) => setDataContrato(e.target.value)}
              className="w-full mt-1 rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] px-3 py-2.5 text-sm outline-none focus:border-[#6639A6]"
            />
          </div>

          {/* Compartilhar com o grupo */}
          {membros.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Compartilhar com (ver e editar)
              </label>
              <div className="mt-1 rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] divide-y divide-[#ECE6F2]">
                {membros.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!selecionados[m.id]}
                      onChange={() => toggleMembro(m.id)}
                      className="accent-[#6639A6] w-4 h-4"
                    />
                    <span className="truncate">{m.nome || m.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-gray-500">
            O valor do imóvel não é informado aqui: ele será a soma dos valores dos fluxos de
            pagamento cadastrados na próxima etapa.
          </p>

          {erro && <p className="text-xs text-red-500">{erro}</p>}

          <button
            onClick={() => void salvar()}
            disabled={saving}
            className="w-full mt-2 bg-[#6639A6] hover:bg-[#4A247A] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {saving ? 'Salvando…' : 'Salvar imóvel'}
          </button>
        </div>
      </div>
    </div>
  )
}
