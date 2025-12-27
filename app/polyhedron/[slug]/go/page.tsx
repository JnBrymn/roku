'use client'

import { useState, useEffect } from 'react'
import { notFound } from 'next/navigation'
import GoPolyhedronViewer from '@/components/GoPolyhedronViewer'
import GoGameControls from '@/components/GoGameControls'
import GoGameStatus from '@/components/GoGameStatus'
import GoErrorMessage from '@/components/GoErrorMessage'
import { polyhedraData } from '@/lib/polyhedronUtils'
import { parsePolyhedronData } from '@/lib/polyhedronUtils'
import { GoGame } from '@/lib/goGame'

export default function GoPolyhedronPage({ params }: { params: { slug: string } }) {
  const polyhedron = polyhedraData.find((p) => p.slug === params.slug)
  const [game, setGame] = useState<GoGame | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
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

  const handleStateChange = () => {
    setUpdateTrigger(prev => prev + 1)
  }

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
      <GoErrorMessage message={errorMessage} />
    </div>
  )
}

