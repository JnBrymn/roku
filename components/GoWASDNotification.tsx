'use client'

import { useEffect, useState } from 'react'

interface GoWASDNotificationProps {
  /** Duration in milliseconds to show the notification (default: 4000) */
  duration?: number
}

/**
 * Displays a notification showing WASD controls when the page first loads.
 * Automatically hides after a duration.
 */
export default function GoWASDNotification({ duration = 4000 }: GoWASDNotificationProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration])

  if (!visible) {
    return null
  }

  return (
    <div className="go-pass-notification">
      WASD to move
    </div>
  )
}

