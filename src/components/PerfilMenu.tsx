import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, HelpCircle, LogOut, Pencil, UserRoundCheck, LifeBuoy } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/context/AuthContext'
import { useVerComoCliente } from '@/context/VerComoClienteContext'
import { EditarPerfilDialog } from '@/components/EditarPerfilDialog'
import { ContatoModal } from '@/components/ContatoModal'
import { urlAvatar } from '@/services/perfil'

/**
 * Menu do perfil no header: editar perfil, ajuda (agente de suporte),
 * atendimentos (SÓ admin, e some no modo "ver como cliente"), toggle
 * "Ver como cliente" (admin), contato e sair.
 */
export function PerfilMenu() {
  const { user, logout } = useAuth()
  const { verComoCliente, alternar } = useVerComoCliente()
  const navigate = useNavigate()
  const [abrirEditar, setAbrirEditar] = useState(false)
  const [abrirContato, setAbrirContato] = useState(false)

  const isAdmin = !!user?.is_admin

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menu do perfil"
            className="ml-auto rounded-full focus-visible:ring-2 focus-visible:ring-[#6639A6] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Avatar className="h-9 w-9 border-2 border-white/40">
              {user?.avatar ? (
                <AvatarImage
                  src={urlAvatar(user.avatar, user.id) || ''}
                  alt={`Foto de ${user.name || 'perfil'}`}
                />
              ) : null}
              <AvatarFallback className="bg-[#F1EAF9] text-sm font-bold text-[#6639A6]">
                {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="truncate">
            {user?.name || user?.email}
            {isAdmin && !verComoCliente && (
              <span className="ml-1 rounded bg-[#F1EAF9] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#6639A6]">
                Admin
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setAbrirEditar(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar perfil
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => navigate('/ajuda')}>
            <LifeBuoy className="mr-2 h-4 w-4" /> Ajuda
          </DropdownMenuItem>

          {isAdmin && !verComoCliente && (
            <DropdownMenuItem onSelect={() => navigate('/atendimentos')}>
              <Bot className="mr-2 h-4 w-4" /> Atendimentos
            </DropdownMenuItem>
          )}

          {isAdmin && (
            <div
              className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm"
              role="group"
              aria-label="Modo de visualização"
            >
              <span className="flex items-center gap-2 text-[#1F1438]">
                <UserRoundCheck className="h-4 w-4 text-[#6639A6]" aria-hidden="true" />
                Ver como cliente
              </span>
              <Switch
                checked={verComoCliente}
                onCheckedChange={alternar}
                aria-label="Ver o app como cliente (esconde os itens de admin)"
              />
            </div>
          )}

          <DropdownMenuItem onSelect={() => setAbrirContato(true)}>
            <HelpCircle className="mr-2 h-4 w-4" /> Contato
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              alternar(false)
              logout()
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditarPerfilDialog open={abrirEditar} onOpenChange={setAbrirEditar} />
      <ContatoModal open={abrirContato} onOpenChange={setAbrirContato} />
    </>
  )
}
