'use client'

import { GoGame } from '@/lib/goGame'

interface GoGameControlsProps {
  /** The game instance */
  game: GoGame
  
  /** Callback when game state changes (to trigger re-render) */
  onStateChange: () => void
  
  /** Callback for pass action */
  onPass?: () => void
  
  /** Callback for undo action */
  onUndo?: () => void
  
  /** Callback for redo action */
  onRedo?: () => void
  
  /** Callback for mark ownership action */
  onMarkOwnership?: () => void
  
  /** Whether the current player can make moves */
  canMakeMove?: boolean
}

/**
 * Control buttons for the Go game.
 * Provides pass, undo, redo, and reset functionality.
 */
export default function GoGameControls({ 
  game, 
  onStateChange, 
  onPass,
  onUndo,
  onRedo,
  onMarkOwnership,
  canMakeMove = true 
}: GoGameControlsProps) {
  const handleDone = () => {
    if (onMarkOwnership) {
      // Use sync adapter to send to other player
      onMarkOwnership()
    } else {
      // Local game - just mark ownership locally
      const success = game.markOwnership()
      if (success) {
        onStateChange()
      }
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
          onClick={onPass}
          disabled={isGameOver || !canMakeMove}
          className="pass-button"
        >
          Pass
        </button>
      )}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="undo-button"
      >
        Undo
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="redo-button"
      >
        Redo
      </button>
    </div>
  )
}

