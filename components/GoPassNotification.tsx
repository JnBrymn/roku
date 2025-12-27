'use client'

import { useEffect, useState } from 'react'

interface GoPassNotificationProps {
  /** Player who passed ('black' or 'white') */
  player: 'black' | 'white' | null
  
  /** Duration in milliseconds to show the notification (default: 3000) */
  duration?: number
}

/**
 * Displays a notification when a player passes.
 * Automatically hides after a duration.
 */
export default function GoPassNotification({ player, duration = 3000 }: GoPassNotificationProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (player) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [player, duration])

  if (!visible || !player) {
    return null
  }

  const playerName = player === 'black' ? 'Black' : 'White'

  return (
    <div className="go-pass-notification">
      {playerName} passed
    </div>
  )
}

