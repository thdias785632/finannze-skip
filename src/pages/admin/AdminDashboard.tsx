import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, LifeBuoy, RefreshCw, TrendingUp, Users as UsersIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { resumoAdmin, type ResumoAdmin } from '@/services/admin'
import { NOME_PLANO } from '@/types/financial'
import type { UserPlan } from '@/types/financial'

const CORES_PLANO: Record<UserPlan, string> = {
  basico: 'bg-slate-100 text-slate-700 border-slate-200',
  bronze: 'bg-amber-50 text-amber-800 border-amber-200',
  prata: 'bg-gray-100 text-gray-500 border-gray-200',
  ouro: 'bg-violet-50 text-violet-800 border-violet-200',
}

/** Dashboard do painel admin: números de usuários por plano e atendimentos. */
export const AdminDashboard: React.FC = () => {
  const { toast } = useToast()
  const [resumo, setResumo] = useState<ResumoAdmin | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = async () => {
    setCarregando(true)
    setErro('')
    try {
      setResumo(await resumoAdmin())
    } catch (e) {
      setErro((e as Error).message || 'Erro ao carregar o resumo')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20 text-[#7C3AED]">
        <RefreshCw className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    )
  }

  if (erro || !resumo) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-[#6B7280]">{erro || 'Não foi possível carregar.'}</p>
          <Button variant="outline" onClick={() => void carregar()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tentar de novo
          </Button>
        </CardContent>
      </Card>
    )
  }

  const planos: UserPlan[] = ['basico', 'bronze', 'ouro']

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#2D2350]">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={() => void carregar()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Números principais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[#8B8B9E] flex items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5" aria-hidden /> Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#2D2350]">{resumo.total_usuarios}</p>
            <p className="text-xs text-[#8B8B9E] mt-1">Total de cadastros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[#8B8B9E] flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden /> Últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#2D2350]">{resumo.novos_7_dias}</p>
            <p className="text-xs text-[#8B8B9E] mt-1">
              {resumo.novos_30_dias} nos últimos 30 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[#8B8B9E] flex items-center gap-1.5">
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden /> Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#2D2350]">{resumo.atendimentos_pendentes}</p>
            <Link
              to="/admin/atendimentos"
              className="text-xs font-semibold text-[#7C3AED] hover:underline mt-1 inline-block"
            >
              Ver atendimentos →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[#8B8B9E] flex items-center gap-1.5">
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Novos 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#2D2350]">{resumo.novos_30_dias}</p>
            <p className="text-xs text-[#8B8B9E] mt-1">Cadastros recentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Usuários por plano */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold text-[#2D2350]">Usuários por plano</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {planos.map((plano) => {
            const qtd = resumo.por_plano?.[plano] ?? 0
            const pct =
              resumo.total_usuarios > 0 ? Math.round((qtd / resumo.total_usuarios) * 100) : 0
            return (
              <div key={plano} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#2D2350]">{NOME_PLANO[plano]}</span>
                  <span className="text-[#6B7280]">
                    {qtd} usuário{qtd === 1 ? '' : 's'} ({pct}%)
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#EFEBF6] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${plano === 'ouro' ? 'bg-[#7C3AED]' : plano === 'bronze' ? 'bg-amber-500' : 'bg-slate-400'}`}
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={qtd}
                    aria-valuemin={0}
                    aria-valuemax={resumo.total_usuarios}
                    aria-label={`Usuários no plano ${NOME_PLANO[plano]}`}
                  />
                </div>
              </div>
            )
          })}
          {(resumo.por_plano?.prata ?? 0) > 0 && (
            <p className="text-xs text-[#8B8B9E] pt-1">
              {resumo.por_plano.prata} usuária(o)s ainda no plano Prata (desativado — mude o plano
              deles na tela Usuários).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
