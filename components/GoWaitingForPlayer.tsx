'use client'

interface GoWaitingForPlayerProps {
  waiting: boolean
}

export default function GoWaitingForPlayer({ waiting }: GoWaitingForPlayerProps) {
  if (!waiting) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '2rem',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        borderRadius: '8px',
        fontSize: '1.25rem',
        zIndex: 1000,
        textAlign: 'center'
      }}
    >
      Waiting for opponent to join...
    </div>
  )
}

