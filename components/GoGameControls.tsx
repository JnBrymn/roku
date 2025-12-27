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

  const handleReset = () => {
    game.reset()
    onStateChange()
  }

  // Check if undo/redo are available
  const canUndo = game.canUndo()
  const canRedo = game.canRedo()
  const isGameOver = game.isGameOver()

  return (
    <div className="go-game-controls">
      <button
        onClick={handlePass}
        disabled={isGameOver}
        className="pass-button"
      >
        Pass
      </button>
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
      <button
        onClick={handleReset}
        className="reset-button"
      >
        Reset
      </button>
    </div>
  )
}

