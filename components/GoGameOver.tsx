'use client'

import { useRouter } from 'next/navigation'
import { GoGame } from '@/lib/goGame'

interface GoGameOverProps {
  /** The game instance */
  game: GoGame
}

/**
 * Displays Game Over screen with final scores.
 * Only visible when game is over.
 * Shows at bottom right with "Return to Main" button.
 */
export default function GoGameOver({ game }: GoGameOverProps) {
  const router = useRouter()
  const isGameOver = game.isGameOver()
  
  // Check if ownership has been marked (no empty vertices)
  const board = game.getBoard()
  const hasEmptyVertices = Array.from(board.values()).some(state => state === null)
  
  // Don't render if game is not over OR if ownership hasn't been assigned yet
  if (!isGameOver || hasEmptyVertices) {
    return null
  }
  
  // Get final scores
  const { blackCaptures, whiteCaptures } = game.getCapturedCounts()
  const { blackDead, whiteDead } = game.getDeadCounts()
  const { blackControlled, whiteControlled } = game.getControlledCounts()
  const uncontrolled = game.getUncontrolledCount()
  
  // Calculate totals: controlled - captured - dead
  const blackTotal = blackControlled - blackCaptures - blackDead
  const whiteTotal = whiteControlled - whiteCaptures - whiteDead
  
  // Determine winner
  const winner = blackTotal > whiteTotal ? 'Black' : whiteTotal > blackTotal ? 'White' : 'Tie'
  
  const handleReturnToMain = () => {
    router.push('/')
  }
  
  return (
    <div className="go-game-over">
      <div className="game-over-title">Game Over</div>
      <div className="final-scores">
        <div className="score-row">
          <span className="score-label">Black:</span>
          <span className="score-value">{blackTotal}</span>
        </div>
        <div className="score-row">
          <span className="score-label">White:</span>
          <span className="score-value">{whiteTotal}</span>
        </div>
        <div className="score-row">
          <span className="score-label">uncontrolled:</span>
          <span className="score-value">{uncontrolled}</span>
        </div>
        <div className="winner-message">
          {winner === 'Tie' ? 'Tie Game' : `${winner} Wins!`}
        </div>
      </div>
      <button onClick={handleReturnToMain} className="return-to-main-button">
        Return to Main
      </button>
    </div>
  )
}

