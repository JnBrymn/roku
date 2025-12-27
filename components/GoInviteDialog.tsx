'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface GoInviteDialogProps {
  open: boolean
  onClose: () => void
  polyhedronSlug: string
}

export default function GoInviteDialog({ open, onClose, polyhedronSlug }: GoInviteDialogProps) {
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  if (!open) return null

  const handleRoleSelect = async (otherPlayerRole: 'black' | 'white') => {
    // Generate session ID
    const sessionId = crypto.randomUUID()
    
    // Create URL for the other player with their selected role
    const url = `${window.location.origin}/polyhedron/${polyhedronSlug}/go/${sessionId}?role=${otherPlayerRole}`
    
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      
      // Navigate to new session with opposite role (your role)
      const yourRole = otherPlayerRole === 'black' ? 'white' : 'black'
      router.push(`/polyhedron/${polyhedronSlug}/go/${sessionId}?role=${yourRole}`)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      // Still navigate even if copy fails
      const yourRole = otherPlayerRole === 'black' ? 'white' : 'black'
      router.push(`/polyhedron/${polyhedronSlug}/go/${sessionId}?role=${yourRole}`)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          maxWidth: '400px',
          width: '90%'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, color: '#000' }}>Invite Player</h2>
        <p style={{ color: '#000' }}>Other player is:</p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button
            onClick={() => handleRoleSelect('black')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: '#000',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              flex: 1
            }}
          >
            Black
          </button>
          <button
            onClick={() => handleRoleSelect('white')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: '#fff',
              color: '#000',
              border: '2px solid #000',
              borderRadius: '4px',
              cursor: 'pointer',
              flex: 1
            }}
          >
            White
          </button>
        </div>
        {copied && (
          <p style={{ marginTop: '1rem', color: 'green' }}>
            URL copied to clipboard! Share with your opponent.
          </p>
        )}
        <button
          onClick={onClose}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#ccc',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

