'use client'

import { useEffect, useState } from 'react'

interface GoClipboardNotificationProps {
  /** Whether to show the notification */
  show: boolean
  
  /** Duration in milliseconds to show the notification (default: 3000) */
  duration?: number
}

/**
 * Displays a notification when a URL is copied to clipboard.
 * Automatically hides after a duration.
 */
export default function GoClipboardNotification({ show, duration = 3000 }: GoClipboardNotificationProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [show, duration])

  if (!visible || !show) {
    return null
  }

  return (
    <div className="go-pass-notification">
      URL copied to clipboard! Share with your opponent.
    </div>
  )
}

