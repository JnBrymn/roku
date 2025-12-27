'use client'

import { useState, useEffect, useCallback } from 'react'
import { notFound } from 'next/navigation'
import GoPolyhedronViewer from '@/components/GoPolyhedronViewer'
import GoGameControls from '@/components/GoGameControls'
import GoGameStatus from '@/components/GoGameStatus'
import GoGameOver from '@/components/GoGameOver'
import GoErrorMessage from '@/components/GoErrorMessage'
import { polyhedraData } from '@/lib/polyhedronUtils'
import { parsePolyhedronData } from '@/lib/polyhedronUtils'
import { GoGame } from '@/lib/goGame'

export default function GoPolyhedronPage({ params }: { params: { slug: string } }) {
  const polyhedron = polyhedraData.find((p) => p.slug === params.slug)
  const [game, setGame] = useState<GoGame | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [ownershipError, setOwnershipError] = useState<string | null>(null)
  const [updateTrigger, setUpdateTrigger] = useState(0)

  // Initialize game when polyhedron data is loaded
  useEffect(() => {
    if (!polyhedron) return

    const initGame = async () => {
      try {
        const response = await fetch(polyhedron.file)
        const text = await response.text()
        const data = parsePolyhedronData(text)
        
        const newGame = new GoGame(data.vertices, data.edges)
        setGame(newGame)
      } catch (error) {
        console.error('Failed to initialize game:', error)
        setErrorMessage('Failed to load polyhedron data')
      }
    }

    initGame()
  }, [polyhedron])

  const handlePlaceStone = (vertexIndex: number) => {
    if (!game) return

    const result = game.makeMove(vertexIndex)
    
    if (!result.legal) {
      // Show error message
      setErrorMessage(result.reason || 'Illegal move')
    } else {
      // Clear any previous error
      setErrorMessage(null)
    }
    
    // Trigger re-render
    setUpdateTrigger(prev => prev + 1)
  }

  const handleRemoveGroup = (vertexIndex: number) => {
    if (!game) return

    const success = game.removeGroup(vertexIndex)
    
    if (success) {
      // Clear any previous error
      setErrorMessage(null)
      // Trigger re-render
      setUpdateTrigger(prev => prev + 1)
    }
  }

  const handleStateChange = useCallback(() => {
    setUpdateTrigger(prev => prev + 1)
    
    // Check for ownership errors when game is over and there are empty vertices
    if (game && game.isGameOver()) {
      const board = game.getBoard()
      const hasEmptyVertices = Array.from(board.values()).some(state => state === null)
      
      if (hasEmptyVertices) {
        const ownershipInfo = game.getOwnershipInfo()
        if (ownershipInfo.hasError) {
          setOwnershipError(ownershipInfo.errorMessage || 'Invalid ownership state detected')
        } else {
          setOwnershipError(null)
        }
      } else {
        setOwnershipError(null)
      }
    } else {
      setOwnershipError(null)
    }
  }, [game])

  const handlePass = useCallback(() => {
    if (!game) return
    if (game.isGameOver()) return
    game.pass()
    handleStateChange()
  }, [game, handleStateChange])

  const handleUndo = useCallback(() => {
    if (!game) return
    if (game.undo()) {
      handleStateChange()
    }
  }, [game, handleStateChange])

  const handleRedo = useCallback(() => {
    if (!game) return
    if (game.redo()) {
      handleStateChange()
    }
  }, [game, handleStateChange])

  // Keyboard shortcuts: P for pass, U for undo, R for redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const key = e.key.toLowerCase()
      
      if (key === 'p') {
        e.preventDefault()
        handlePass()
      } else if (key === 'u') {
        e.preventDefault()
        handleUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handlePass, handleUndo])

  if (!polyhedron) {
    notFound()
  }

  if (!game) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <GoPolyhedronViewer
        dataFile={polyhedron.file}
        name={polyhedron.name}
        game={game}
        onPlaceStone={handlePlaceStone}
        onRemoveGroup={handleRemoveGroup}
        onStateChange={handleStateChange}
        updateTrigger={updateTrigger}
      />
      <GoGameStatus game={game} />
      <GoGameControls game={game} onStateChange={handleStateChange} />
      <GoGameOver game={game} />
      <GoErrorMessage message={errorMessage || ownershipError} />
    </div>
  )
}

