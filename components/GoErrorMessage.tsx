'use client'

import { useEffect, useState } from 'react'

interface GoErrorMessageProps {
  /** Error message to display */
  message: string | null
  
  /** Duration in milliseconds to show the message (default: 3000) */
  duration?: number
}

/**
 * Displays error messages to the user.
 * Automatically hides after a duration.
 */
export default function GoErrorMessage({ message, duration = 3000 }: GoErrorMessageProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [message, duration])

  if (!visible || !message) {
    return null
  }

  return (
    <div className="go-error-message">
      {message}
    </div>
  )
}

