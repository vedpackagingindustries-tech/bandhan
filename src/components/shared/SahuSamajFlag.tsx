'use client'

import { motion } from 'framer-motion'

interface FlagProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'h-8 w-12',
  md: 'h-12 w-[4.5rem]',
  lg: 'h-16 w-24',
}

export function SahuSamajFlag({ className = '', size = 'sm' }: FlagProps) {
  return (
    <div className={`relative inline-flex items-end ${sizeMap[size]} ${className}`}>
      {/* Pole */}
      <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-gradient-to-b from-gold via-gold-dark to-gold/60" />

      {/* Flag cloth with wave animation */}
      <motion.div
        className="relative ml-[3px] overflow-hidden rounded-r-sm"
        style={{ height: '100%', width: 'calc(100% - 3px)' }}
        animate={{
          scaleY: [1, 1.02, 1, 0.98, 1],
          scaleX: [1, 1.01, 0.99, 1.01, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <img
          src="/sahu-samaj-flag.png"
          alt="Sahu Samaj Flag"
          className="h-full w-full object-cover"
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
          }}
        />
        {/* Subtle cloth wave overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 30%, transparent 60%, rgba(0,0,0,0.05) 80%, transparent 100%)',
          }}
        />
      </motion.div>
    </div>
  )
}
