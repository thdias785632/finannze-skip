import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, UserRound } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { salvarPerfil, excluirConta, urlAvatar, type PerfilForm } from '@/services/perfil'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Diálogo "Editar perfil": nome, telefone com DDI e foto de perfil. E-mail é
 * só leitura (troca de e-mail no PocketBase mexe em auth/identity — fora do
 * escopo desta rodada). "Excluir perfil" abre a confirmação que apaga a conta.
 */
export const EditarPerfilDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { user, refresh, logout } = useAuth()
  const { toast } = useToast()
  const inputArquivoRef = useRef<HTMLInputElement>(null)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removerAvatar, setRemoverAvatar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [dialogExcluir, setDialogExcluir] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    if (open && user) {
      setNome(user.name || '')
      setTelefone(user.telefone || '')
      setAvatar(null)
      setPreview(null)
      setRemoverAvatar(false)
    }
  }, [open, user])

  if (!user) return null

  const avatarAtual = urlAvatar(user.avatar, user.id)
  const previewFinal = preview ?? (removerAvatar ? null : (avatarAtual ?? null))
  const iniciais = (user.name || user.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  const escolherArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setAvatar(f)
    setRemoverAvatar(false)
    setPreview(URL.createObjectURL(f))
  }

  const salvar = async () => {
    if (!nome.trim()) {
      toast({ variant: 'destructive', title: 'Informe seu nome' })
      return
    }
    setSalvando(true)
    try {
      const dados: PerfilForm = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        avatar,
        removerAvatar,
      }
      await salvarPerfil(user, dados)
      await refresh()
      toast({ title: 'Perfil salvo', description: 'Suas informações foram atualizadas.' })
      onOpenChange(false)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: (err as Error).message || 'Tente novamente.',
      })
    } finally {
      setSalvando(false)
    }
  }

  const confirmarExclusao = async () => {
    setExcluindo(true)
    try {
      await excluirConta(user)
      logout()
      toast({ title: 'Conta excluída', description: 'Sentiremos sua falta. Até logo!' })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: (err as Error).message,
      })
    } finally {
      setExcluindo(false)
      setDialogExcluir(false)
      onOpenChange(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>
              Atualize suas informações. Elas ficam associadas à sua conta.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void salvar()
            }}
          >
            {/* Foto */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border border-[#E2D6F0]">
                {previewFinal ? (
                  <AvatarImage
                    src={previewFinal}
                    alt={`Foto de perfil de ${user.name || 'usuário'}`}
                  />
                ) : null}
                <AvatarFallback className="bg-[#EFEBF6] text-[#8B8B9E]">
                  {iniciais || <UserRound className="h-8 w-8 text-[#8B8B9E]" strokeWidth={1.8} />}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputArquivoRef.current?.click()}
                >
                  Trocar foto
                </Button>
                {(avatarAtual || previewFinal) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      setAvatar(null)
                      setRemoverAvatar(true)
                      setPreview(null)
                    }}
                  >
                    Remover foto
                  </Button>
                )}
              </div>
              <input
                ref={inputArquivoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={escolherArquivo}
                aria-label="Selecionar foto de perfil"
              />
            </div>

            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="perfil-nome">Nome</Label>
              <Input
                id="perfil-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                placeholder="Seu nome"
              />
            </div>

            {/* Telefone com DDI */}
            <div className="space-y-1.5">
              <Label htmlFor="perfil-telefone">Telefone (com DDI)</Label>
              <Input
                id="perfil-telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                autoComplete="tel"
                placeholder="+55 11 91234-5678"
              />
              <p className="text-xs text-[#6B7280]">Inclua o código do país, ex.: +55.</p>
            </div>

            {/* E-mail: só leitura */}
            <div className="space-y-1.5">
              <Label htmlFor="perfil-email">E-mail</Label>
              <Input id="perfil-email" value={user.email} readOnly disabled />
              <p className="text-xs text-[#6B7280]">O e-mail não pode ser alterado por aqui.</p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 mr-auto"
                onClick={() => setDialogExcluir(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir perfil
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

      <AlertDialog open={dialogExcluir} onOpenChange={setDialogExcluir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga permanentemente sua conta e todos os seus dados — transações, cartões,
              imóveis, grupos e divisões. Não tem como desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={(e) => {
                e.preventDefault()
                void confirmarExclusao()
              }}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600 text-white"
            >
              {excluindo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir para sempre
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
