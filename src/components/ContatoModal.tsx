import React from 'react'
import { Mail, MessageCircle, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Fallback quando o secret WHATSAPP_CONTATO_URL não está configurado. */
const WHATSAPP_PADRAO = '554391141968'

/**
 * Modal de contato com duas opções: WhatsApp (link wa.me, com ícone ao lado do
 * texto) e e-mail (mailto: para contato@quitafy.com.br).
 *
 * A URL do WhatsApp vem da rota pública GET /backend/v1/config/contato (secret
 * WHATSAPP_CONTATO_URL). Sem o secret, cai no wa.me do número padrão acima.
 */
export const ContatoModal: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
}> = ({ open, onOpenChange }) => {
  const [urlWhats, setUrlWhats] = React.useState<string | null>(null)

  React.useEffect(() => {
    let ativo = true
    import('@/services/perfil')
      .then(({ buscarUrlContato }) => buscarUrlContato())
      .then((url) => {
        if (ativo) setUrlWhats(url)
      })
      .catch(() => {
        if (ativo) setUrlWhats(null)
      })
    return () => {
      ativo = false
    }
  }, [])

  const whatsappUrl = urlWhats || `https://wa.me/${WHATSAPP_PADRAO}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-[#1F1438]">
            <MessageCircle className="h-5 w-5 text-[#6639A6]" /> Fale com a gente
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Escolha por onde quer falar com o suporte do Quitafy.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6639A6] focus-visible:ring-offset-2"
          >
            {/* Ícone oficial do WhatsApp, junto ao texto da opção */}
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.347-.347.52-.52.174-.174.232-.298.347-.497.115-.198.057-.371-.058-.52-.115-.148-.658-1.584-.902-2.17-.237-.57-.48-.49-.658-.499-.174-.008-.372-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c1.746.943 3.71 1.444 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.48-8.45zM12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.977 1.005-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.437-9.884 9.883-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.889-9.887 9.889z" />
            </svg>
            WhatsApp
          </a>

          <a
            href="mailto:contato@quitafy.com.br"
            className="flex items-center gap-3 rounded-2xl bg-[#6639A6] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#522c8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6639A6] focus-visible:ring-offset-2"
          >
            <Mail className="h-5 w-5 shrink-0" aria-hidden="true" />
            E-mail
          </a>

          <p className="text-center text-xs text-gray-500">
            WhatsApp do suporte ou e-mail para{' '}
            <span className="font-semibold">contato@quitafy.com.br</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
