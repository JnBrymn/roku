'use client'

import { GoGame, StoneColor } from '@/lib/goGame'

interface GoGameStatusProps {
  /** The game instance */
  game: GoGame
}

/**
 * Displays current game status.
 * Shows current player, move count, and game over message.
 */
export default function GoGameStatus({ game }: GoGameStatusProps) {
  const currentPlayer = game.getCurrentPlayer()
  const moveCount = game.getMoveCount()
  const isGameOver = game.isGameOver()

  const getPlayerDisplay = (color: StoneColor): string => {
    return color === 'black' ? 'Black' : 'White'
  }

  return (
    <div className="go-game-status">
      {isGameOver ? (
        <div className="game-over-message">
          Game Over
        </div>
      ) : (
        <div className="current-player">
          {getPlayerDisplay(currentPlayer)} to play
        </div>
      )}
      <div className="move-count">
        Move {moveCount}
      </div>
    </div>
  )
}

