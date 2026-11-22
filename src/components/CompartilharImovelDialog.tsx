import { useEffect, useState } from 'react'
import { imoveisService } from '@/services/imoveis'
import { gruposService, type MembroGrupo } from '@/services/grupos'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Users } from 'lucide-react'

/**
 * Seletor de compartilhamento do imóvel com membros dos grupos do usuário.
 *
 * Regra acordada (0.0.39): membros do grupo ganham VER E EDITAR — a regra
 * "update" da coleção `imoveis` já permite a quem está em `compartilhado_com`.
 * O valor do imóvel nasce da soma dos fluxos (nunca é informado aqui).
 */
export const CompartilharImovelDialog: React.FC<{
  imovelId: string
  compartilhadoAtual: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}> = ({ imovelId, compartilhadoAtual, open, onOpenChange, onSaved }) => {
  const { toast } = useToast()
  const [membros, setMembros] = useState<MembroGrupo[]>([])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(compartilhadoAtual))
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setMembros(await gruposService.meusMembros())
    } catch {
      /* sem grupos — o diálogo mostra o vazio */
    }
  }

  useEffect(() => {
    if (open) void load()
  }, [open])

  useRealtime('grupos', () => void load(), open)

  const toggle = (uid: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const salvar = async () => {
    setSaving(true)
    try {
      await imoveisService.update(imovelId, {
        compartilhado_com: Array.from(selecionados),
      })
      toast({ title: 'Compartilhamento salvo' })
      onOpenChange(false)
      onSaved()
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao compartilhar imóvel' })
    } finally {
      setSaving(false)
    }
  }

  const porUsuario = new Map<string, MembroGrupo>()
  for (const m of membros) {
    if (m.user_id && !porUsuario.has(m.user_id)) porUsuario.set(m.user_id, m)
  }
  const unicos = Array.from(porUsuario.values())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border-[#EBE4F5] bg-white p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-[#1F1438]">
            <Users className="w-4 h-4 text-[#6639A6]" />
            Compartilhar imóvel
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Membros dos seus grupos poderão <strong>ver e editar</strong> este imóvel, incluindo os
            fluxos de pagamento.
          </DialogDescription>
        </DialogHeader>

        {unicos.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">
            Você ainda não tem membros em nenhum grupo. Crie um grupo na aba Grupos e convide
            pessoas para poder compartilhar.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2 my-2">
            {unicos.map((m) => (
              <label
                key={m.user_id}
                className="flex items-center gap-3 rounded-xl border border-[#EBE4F5] px-3 py-2 cursor-pointer hover:bg-[#F6F3FB]"
              >
                <Checkbox
                  checked={selecionados.has(m.user_id)}
                  onCheckedChange={() => toggle(m.user_id)}
                  className="accent-[#6639A6]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#1F1438] truncate">
                    {m.nome || m.email}
                  </span>
                  <span className="block text-[11px] text-gray-500 truncate">{m.email}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <Button
          onClick={() => void salvar()}
          disabled={saving || unicos.length === 0}
          className="w-full bg-[#6639A6] hover:bg-[#522c8a] text-white font-bold rounded-xl"
        >
          {saving ? 'Salvando…' : 'Salvar compartilhamento'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
