'use client'

import { GoGame } from '@/lib/goGame'

interface GoGameStatusProps {
  /** The game instance */
  game: GoGame
}

/**
 * Displays current game status.
 * Shows Black and White areas with captured stone counts.
 * Highlights the current player's area with a white border.
 */
export default function GoGameStatus({ game }: GoGameStatusProps) {
  const currentPlayer = game.getCurrentPlayer()
  const isGameOver = game.isGameOver()
  const { blackCaptures, whiteCaptures } = game.getCapturedCounts()
  const { blackDead, whiteDead } = game.getDeadCounts()
  const { blackOccupied, whiteOccupied } = game.getOccupiedCounts()
  const { blackControlled, whiteControlled } = game.getControlledCounts()
  
  // Determine which player's turn it is (if game is not over)
  const blackTurn = !isGameOver && currentPlayer === 'black'
  const whiteTurn = !isGameOver && currentPlayer === 'white'

  return (
    <div className="go-game-status">
      <div className={`player-area black-area ${blackTurn ? 'active' : ''}`}>
        <div className="player-label">Black</div>
        <div className="metric-row">
          <span className="metric-label">occupied</span>
          <span className="metric-value">{blackOccupied}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">captured</span>
          <span className="metric-value">{blackCaptures}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">dead</span>
          <span className="metric-value">{blackDead}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">controlled</span>
          <span className="metric-value">{blackControlled}</span>
        </div>
      </div>
      <div className={`player-area white-area ${whiteTurn ? 'active' : ''}`}>
        <div className="player-label">White</div>
        <div className="metric-row">
          <span className="metric-label">occupied</span>
          <span className="metric-value">{whiteOccupied}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">captured</span>
          <span className="metric-value">{whiteCaptures}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">dead</span>
          <span className="metric-value">{whiteDead}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">controlled</span>
          <span className="metric-value">{whiteControlled}</span>
        </div>
      </div>
    </div>
  )
}

