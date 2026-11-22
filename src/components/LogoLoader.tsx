import React from 'react'
import appIcon from '@/assets/logo-192-8a6a4.png'
import '@/components/logo-loader.css'

interface LogoLoaderProps {
  size?: number
  className?: string
}

/* Loading do site: o logo do Finanzze pulsando no lugar do spinner */
export const LogoLoader: React.FC<LogoLoaderProps> = ({ size = 56, className = '' }) => (
  <div
    className={`flex items-center justify-center ${className}`}
    role="status"
    aria-label="Carregando"
  >
    <img src={appIcon} alt="" width={size} height={size} className="finz-logo-loader rounded-xl" />
  </div>
)
