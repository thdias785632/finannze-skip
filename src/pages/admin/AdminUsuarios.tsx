import React, { useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { atualizarUsuario, listarUsuarios, type UsuarioAdmin } from '@/services/admin'
import { NOME_PLANO } from '@/types/financial'
import type { UserPlan } from '@/types/financial'
import { exibirTelefone, formatarTelefoneBr, normalizarTelefoneComDdi } from '@/lib/telefone'

const PLANOS_EDITAVEIS: UserPlan[] = ['basico', 'bronze', 'ouro'] // Prata desativado

const rotuloData = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/** Tela Usuários do painel: lista, busca e edição (telefone, plano, nome). */
export const AdminUsuarios: React.FC = () => {
  const { toast } = useToast()
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [editando, setEditando] = useState<UsuarioAdmin | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formTelefone, setFormTelefone] = useState('')
  const [formPlano, setFormPlano] = useState<UserPlan>('basico')
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    setErro('')
    try {
      setUsuarios(await listarUsuarios(busca))
    } catch (e) {
      setErro((e as Error).message || 'Erro ao carregar usuários')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return usuarios
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(t) ||
        u.email.toLowerCase().includes(t) ||
        (u.telefone || '').includes(t),
    )
  }, [usuarios, busca])

  const abrirEdicao = (u: UsuarioAdmin) => {
    setEditando(u)
    setFormNome(u.nome)
    setFormTelefone(exibirTelefone(u.telefone))
    setFormPlano(PLANOS_EDITAVEIS.includes(u.plano) ? u.plano : 'basico')
  }

  const salvar = async () => {
    if (!editando) return
    if (!formNome.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome' })
      return
    }
    const telNormalizado = normalizarTelefoneComDdi(formTelefone)
    if (!telNormalizado) {
      toast({
        variant: 'destructive',
        title: 'Telefone inválido',
        description: 'Informe um telefone válido com DDI, ex.: +55 (11) 99999-8888',
      })
      return
    }
    setSalvando(true)
    try {
      const atualizado = await atualizarUsuario(editando.id, {
        nome: formNome.trim(),
        telefone: telNormalizado,
        plano: formPlano,
      })
      setUsuarios((lista) => lista.map((u) => (u.id === atualizado.id ? atualizado : u)))
      setEditando(null)
      toast({
        title: 'Usuário atualizado',
        description: `${atualizado.nome} agora está no plano ${NOME_PLANO[atualizado.plano]}.`,
      })
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: (e as Error).message })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#2D2350]">Usuários</h1>
        <Button variant="outline" size="sm" onClick={() => void carregar()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B8B9E]"
          aria-hidden
        />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone"
          aria-label="Buscar usuários"
          className="pl-9 bg-white"
        />
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-20 text-[#7C3AED]">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : erro ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-[#6B7280]">{erro}</p>
            <Button variant="outline" onClick={() => void carregar()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[#6B7280]">
            Nenhum usuário encontrado{busca ? ` para “${busca}”` : ''}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtrados.map((u) => (
            <Card key={u.id} className="bg-white">
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[#2D2350] truncate">{u.nome || u.email}</p>
                    {u.is_admin && (
                      <Badge className="bg-[#EFEBF6] text-[#7C3AED] hover:bg-[#EFEBF6]">
                        <ShieldCheck className="mr-1 h-3 w-3" aria-hidden /> Admin
                      </Badge>
                    )}
                    <Badge variant="outline" className="border-[#E2D6F0] text-[#7C3AED]">
                      {NOME_PLANO[u.plano] || u.plano}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#6B7280] truncate">{u.email}</p>
                  <p className="text-xs text-[#8B8B9E]">
                    {u.telefone ? exibirTelefone(u.telefone) : 'Sem telefone'} · cadastro{' '}
                    {rotuloData(u.created)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => abrirEdicao(u)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edição do usuário */}
      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>
              {editando?.email} — as mudanças valem na conta dele imediatamente.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void salvar()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="adm-nome">Nome</Label>
              <Input
                id="adm-nome"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-telefone">Telefone (com DDI)</Label>
              <Input
                id="adm-telefone"
                type="tel"
                inputMode="tel"
                value={formTelefone}
                onChange={(e) => setFormTelefone(formatarTelefoneBr(e.target.value))}
                autoComplete="off"
                placeholder="+55 (11) 99999-8888"
              />
              <p className="text-xs text-[#6B7280]">
                Salvar aqui também atualiza o vínculo do WhatsApp do usuário (whatsapp_contas).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-plano">Plano</Label>
              <Select value={formPlano} onValueChange={(v) => setFormPlano(v as UserPlan)}>
                <SelectTrigger id="adm-plano" className="w-full">
                  <SelectValue placeholder="Escolha o plano" />
                </SelectTrigger>
                <SelectContent>
                  {PLANOS_EDITAVEIS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {NOME_PLANO[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[#6B7280]">O plano Prata está desativado (em breve).</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
