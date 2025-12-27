'use client'

interface GoPlayerRoleIndicatorProps {
  role: 'black' | 'white' | 'both' | null
}

export default function GoPlayerRoleIndicator({ role }: GoPlayerRoleIndicatorProps) {
  if (!role || role === 'both') {
    return null // Don't show for local multiplayer
  }

  const roleText = role === 'black' ? 'Black' : 'White'
  const roleColor = role === 'black' ? '#000' : '#fff'
  const backgroundColor = role === 'black' ? '#000' : '#fff'
  const textColor = role === 'black' ? '#fff' : '#000'
  const borderColor = role === 'black' ? '#000' : '#000'

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '0.5rem 1rem',
        backgroundColor,
        color: textColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '4px',
        fontSize: '0.875rem',
        fontWeight: 'bold',
        zIndex: 100
      }}
    >
      You are: {roleText}
    </div>
  )
}

