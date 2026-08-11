'use client'

import { motion } from 'framer-motion'

interface MataKarmaProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showAura?: boolean
}

const sizeMap = {
  sm: 'h-24 w-24',
  md: 'h-40 w-40',
  lg: 'h-56 w-56',
}

export function MataKarmaVisual({ className = '', size = 'md', showAura = true }: MataKarmaProps) {
  const imgSize = size === 'lg' ? '85%' : size === 'md' ? '80%' : '75%'

  return (
    <div className={`relative inline-flex items-center justify-center ${sizeMap[size]} ${className}`}>
      {showAura && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(200,169,81,0.15), rgba(200,169,81,0.05), rgba(200,169,81,0.2), rgba(200,169,81,0.05), rgba(200,169,81,0.15))',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute inset-1 rounded-full bg-ivory" />
        </motion.div>
      )}

      {showAura && (
        <div
          className="pointer-events-none absolute inset-[-8px] rounded-full opacity-40 blur-xl"
          style={{
            background:
              'radial-gradient(circle, rgba(200,169,81,0.3) 0%, rgba(200,169,81,0.1) 40%, transparent 70%)',
          }}
        />
      )}

      {showAura && (
        <div className="pointer-events-none absolute inset-[-16px]">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 left-1/2 h-[1px] origin-left"
              style={{
                width: size === 'lg' ? '140%' : '130%',
                transform: `rotate(${i * 30}deg)`,
                background:
                  'linear-gradient(90deg, rgba(200,169,81,0.3) 0%, transparent 100%)',
              }}
              animate={{ opacity: [0.15, 0.4, 0.15] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.25,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      <motion.div
        className="relative z-10 overflow-hidden rounded-full"
        style={{
          width: imgSize,
          height: imgSize,
          boxShadow:
            '0 4px 24px rgba(200,169,81,0.25), 0 0 48px rgba(200,169,81,0.1)',
        }}
        animate={{ scale: [1, 1.01, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <img
          src="/karma-mata.png"
          alt="Mata Karma"
          className="h-full w-full object-cover"
        />
      </motion.div>
    </div>
  )
}
