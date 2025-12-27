'use client'

import { useEffect, useState } from 'react'

interface GoSyncWarningProps {
  message: string | null
}

export default function GoSyncWarning({ message }: GoSyncWarningProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setVisible(false)
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [message])

  if (!visible || !message) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '1rem 1.5rem',
        backgroundColor: '#ff9800',
        color: 'white',
        borderRadius: '4px',
        fontSize: '0.875rem',
        zIndex: 1000,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        maxWidth: '90%',
        textAlign: 'center'
      }}
    >
      ⚠️ {message}
    </div>
  )
}

