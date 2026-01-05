'use client'

import { useRouter } from 'next/navigation'

interface GoInviteDialogProps {
  open: boolean
  onClose: () => void
  polyhedronSlug: string
}

// Generate UUID v4 - fallback if crypto.randomUUID is not available
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function GoInviteDialog({ open, onClose, polyhedronSlug }: GoInviteDialogProps) {
  const router = useRouter()

  if (!open) return null

  const handleRoleSelect = (otherPlayerRole: 'black' | 'white') => {
    // Generate session ID
    const sessionId = generateUUID()
    
    // Navigate to new session with opposite role (your role)
    // Add invite flag and otherRole param so we can copy the other player's URL on page load
    const yourRole = otherPlayerRole === 'black' ? 'white' : 'black'
    router.push(`/polyhedron/${polyhedronSlug}/go/${sessionId}?role=${yourRole}&invited=true&otherRole=${otherPlayerRole}`)
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

