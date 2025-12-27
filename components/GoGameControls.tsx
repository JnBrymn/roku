'use client'

import { GoGame } from '@/lib/goGame'

interface GoGameControlsProps {
  /** The game instance */
  game: GoGame
  
  /** Callback when game state changes (to trigger re-render) */
  onStateChange: () => void
}

/**
 * Control buttons for the Go game.
 * Provides pass, undo, redo, and reset functionality.
 */
export default function GoGameControls({ game, onStateChange }: GoGameControlsProps) {
  const handlePass = () => {
    game.pass()
    onStateChange()
  }

  const handleDone = () => {
    const success = game.markOwnership()
    if (success) {
      onStateChange()
    }
  }

  const handleUndo = () => {
    if (game.undo()) {
      onStateChange()
    }
  }

  const handleRedo = () => {
    if (game.redo()) {
      onStateChange()
    }
  }

  // Check if undo/redo are available
  const canUndo = game.canUndo()
  const canRedo = game.canRedo()
  const isGameOver = game.isGameOver()
  
  // Check if there are any empty vertices (null) - if not, ownership has been marked
  const board = game.getBoard()
  const hasEmptyVertices = Array.from(board.values()).some(state => state === null)

  return (
    <div className="go-game-controls">
      {isGameOver && hasEmptyVertices ? (
        <button
          onClick={handleDone}
          className="done-button"
        >
          Done
        </button>
      ) : (
        <button
          onClick={handlePass}
          disabled={isGameOver}
          className="pass-button"
        >
          Pass
        </button>
      )}
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        className="undo-button"
      >
        Undo
      </button>
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        className="redo-button"
      >
        Redo
      </button>
    </div>
  )
}

