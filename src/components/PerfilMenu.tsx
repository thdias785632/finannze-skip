import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserRound, LogOut, MessageCircle, Pencil, Crown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { buscarUrlContato, urlAvatar } from '@/services/perfil'
import { EditarPerfilDialog } from '@/components/EditarPerfilDialog'
import { NOME_PLANO } from '@/types/financial'

/**
 * Item de perfil do usuário no header (no lugar do antigo botão "Sair").
 *
 * Mostra a foto de perfil quando existe (campo avatar do users) ou um ícone
 * cinza de usuário quando não tem. Abre o menu com Editar perfil, Contato
 * (só quando o secret WHATSAPP_CONTATO_URL está configurado no backend —
 * exposto pela rota pública /backend/v1/config/contato) e Sair.
 */
export const PerfilMenu: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [urlContato, setUrlContato] = useState<string | null>(null)
  const [dialogEditar, setDialogEditar] = useState(false)

  useEffect(() => {
    let ativo = true
    buscarUrlContato().then((url) => {
      if (ativo) setUrlContato(url)
    })
    return () => {
      ativo = false
    }
  }, [])

  const avatarUrl = user ? urlAvatar(user.avatar, user.id) : undefined
  const iniciais = (user?.name || user?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  const sair = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Abrir menu do perfil"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#6639A6] focus-visible:ring-offset-2"
        >
          <Avatar className="h-9 w-9 border border-[#E2D6F0]">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={`Foto de perfil de ${user?.name || 'usuário'}`} />
            ) : null}
            <AvatarFallback className="bg-[#EFEBF6] text-[#8B8B9E]">
              {iniciais || <UserRound className="h-5 w-5 text-[#8B8B9E]" strokeWidth={1.8} />}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-56">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-[#1F1438] truncate">
              {user?.name || 'Usuário'}
            </p>
            <p className="text-xs text-[#6B7280] truncate">{user?.email}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#F1EAF9] px-2 py-0.5 text-[10px] font-bold text-[#6639A6]">
              <Crown className="h-3 w-3" />
              Plano {NOME_PLANO[user?.plan || 'basico']}
            </span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialogEditar(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar perfil
          </DropdownMenuItem>
          {urlContato ? (
            <DropdownMenuItem asChild>
              <a
                href={urlContato}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Contato pelo WhatsApp (abre em nova aba)"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Contato
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={sair} className="text-red-600 focus:text-red-700">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditarPerfilDialog open={dialogEditar} onOpenChange={setDialogEditar} />
    </>
  )
}
