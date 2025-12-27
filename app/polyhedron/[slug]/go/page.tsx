'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { notFound, useSearchParams, useRouter } from 'next/navigation'
import GoPolyhedronViewer from '@/components/GoPolyhedronViewer'
import GoGameControls from '@/components/GoGameControls'
import GoGameStatus from '@/components/GoGameStatus'
import GoGameOver from '@/components/GoGameOver'
import GoErrorMessage from '@/components/GoErrorMessage'
import GoInviteDialog from '@/components/GoInviteDialog'
import GoPlayerRoleIndicator from '@/components/GoPlayerRoleIndicator'
import GoSyncWarning from '@/components/GoSyncWarning'
import GoPassNotification from '@/components/GoPassNotification'
import GoClipboardNotification from '@/components/GoClipboardNotification'
import { polyhedraData } from '@/lib/polyhedronUtils'
import { parsePolyhedronData } from '@/lib/polyhedronUtils'
import { GoGame } from '@/lib/goGame'
import { GameSyncAdapter } from '@/lib/gameSync/GameSyncAdapter'
import { LocalGameSync } from '@/lib/gameSync/LocalGameSync'
import { WebSocketGameSync } from '@/lib/gameSync/WebSocketGameSync'

export default function GoPolyhedronPage({ params }: { params: { slug: string; sessionId?: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = params.sessionId || undefined
  const polyhedron = polyhedraData.find((p) => p.slug === params.slug)
  const [game, setGame] = useState<GoGame | null>(null)
  const [gameSync, setGameSync] = useState<GameSyncAdapter | null>(null)
  const [playerRole, setPlayerRole] = useState<'black' | 'white' | 'both' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [ownershipError, setOwnershipError] = useState<string | null>(null)
  const [syncWarning, setSyncWarning] = useState<string | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [updateTrigger, setUpdateTrigger] = useState(0)
  const [passNotificationPlayer, setPassNotificationPlayer] = useState<'black' | 'white' | null>(null)
  const [showClipboardNotification, setShowClipboardNotification] = useState(false)
  const gameSyncRef = useRef<GameSyncAdapter | null>(null)

  // Initialize game and sync adapter when polyhedron data is loaded
  useEffect(() => {
    if (!polyhedron) return

    const initGame = async () => {
      try {
        const response = await fetch(polyhedron.file)
        const text = await response.text()
        const data = parsePolyhedronData(text)
        
        const newGame = new GoGame(data.vertices, data.edges)
        setGame(newGame)

        // Initialize sync adapter based on URL params
        const role = searchParams?.get('role') as 'black' | 'white' | null

        let sync: GameSyncAdapter
        if (sessionId && role) {
          // Remote multiplayer
          sync = new WebSocketGameSync(newGame, sessionId, role)
          setPlayerRole(role)
        } else {
          // Local multiplayer
          sync = new LocalGameSync(newGame)
          setPlayerRole('both')
        }

        gameSyncRef.current = sync
        setGameSync(sync)

        // Set up event handlers
        sync.onMove(() => handleStateChange())
        sync.onPass(() => {
          // Determine which player passed: after a pass, the current player switches
          // (unless it's the second pass and game ended, in which case current player is the one who passed)
          const currentPlayer = newGame.getCurrentPlayer()
          const isGameOver = newGame.isGameOver()
          // If game just ended, current player passed; otherwise, opposite player passed
          const passingPlayer = isGameOver ? currentPlayer : (currentPlayer === 'black' ? 'white' : 'black')
          setPassNotificationPlayer(passingPlayer)
          handleStateChange()
        })
        sync.onUndo(() => handleStateChange())
        sync.onRedo(() => handleStateChange())
        sync.onRemoveGroup(() => handleStateChange())
        sync.onMarkOwnership(() => handleStateChange())
        sync.onStateChange(() => handleStateChange())
        sync.onError((error) => {
          setErrorMessage(error)
        })
        sync.onHashMismatch((warning) => {
          setSyncWarning(warning)
        })
        sync.onStateSync(() => handleStateChange())

        // Request sync if remote
        if (sessionId && role) {
          sync.requestSync()
        }
      } catch (error) {
        console.error('Failed to initialize game:', error)
        setErrorMessage('Failed to load polyhedron data')
      }
    }

    initGame()

    // Cleanup on unmount
    return () => {
      if (gameSyncRef.current) {
        gameSyncRef.current.disconnect()
      }
    }
  }, [polyhedron, params.sessionId, searchParams])

  const handlePlaceStone = (vertexIndex: number) => {
    if (!game || !gameSync) return

    // Check if it's player's turn
    const canMove = playerRole === 'both' || playerRole === game.getCurrentPlayer()
    if (!canMove) {
      setErrorMessage('Not your turn')
      return
    }

    // Send move through sync adapter
    gameSync.sendMove(vertexIndex).then(result => {
      if (!result.success) {
        setErrorMessage(result.reason || 'Illegal move')
      } else {
        setErrorMessage(null)
        setUpdateTrigger(prev => prev + 1)
      }
    })
  }

  const handleRemoveGroup = (vertexIndex: number) => {
    if (!game || !gameSync) return

    // Send remove group through sync adapter
    gameSync.sendRemoveGroup(vertexIndex).then(result => {
      if (result.success) {
        setErrorMessage(null)
        setUpdateTrigger(prev => prev + 1)
      } else {
        setErrorMessage(result.reason || 'Cannot remove group')
      }
    })
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
    if (!game || !gameSync) return
    if (game.isGameOver()) return

    // Check if it's player's turn
    const canMove = playerRole === 'both' || playerRole === game.getCurrentPlayer()
    if (!canMove) {
      setErrorMessage('Not your turn')
      return
    }

    // Capture the current player before passing
    const passingPlayer = game.getCurrentPlayer()

    gameSync.sendPass().then(result => {
      if (result.success) {
        setPassNotificationPlayer(passingPlayer)
        handleStateChange()
      } else {
        setErrorMessage(result.reason || 'Cannot pass')
      }
    })
  }, [game, gameSync, playerRole, handleStateChange])

  const handleUndo = useCallback(() => {
    if (!game || !gameSync) return
    gameSync.sendUndo().then(result => {
      if (result.success) {
        handleStateChange()
      }
    })
  }, [gameSync, handleStateChange])

  const handleRedo = useCallback(() => {
    if (!game || !gameSync) return
    gameSync.sendRedo().then(result => {
      if (result.success) {
        handleStateChange()
      }
    })
  }, [gameSync, handleStateChange])

  const handleMarkOwnership = useCallback(() => {
    if (!game || !gameSync) return
    gameSync.sendMarkOwnership().then(result => {
      if (result.success) {
        handleStateChange()
      }
    })
  }, [gameSync, handleStateChange])

  // Copy other player's URL to clipboard when page loads after invite
  useEffect(() => {
    if (sessionId && searchParams) {
      const invited = searchParams.get('invited')
      const otherRole = searchParams.get('otherRole') as 'black' | 'white' | null
      
      if (invited === 'true' && otherRole) {
        // Create URL for the other player
        const otherPlayerUrl = `${window.location.origin}/polyhedron/${params.slug}/go/${sessionId}?role=${otherRole}`
        
        // Copy to clipboard
        navigator.clipboard.writeText(otherPlayerUrl)
          .then(() => {
            setShowClipboardNotification(true)
            // Remove the query params from URL to avoid re-copying on refresh
            const newUrl = new URL(window.location.href)
            newUrl.searchParams.delete('invited')
            newUrl.searchParams.delete('otherRole')
            window.history.replaceState({}, '', newUrl.toString())
          })
          .catch((error) => {
            console.error('Failed to copy to clipboard:', error)
          })
      }
    }
  }, [sessionId, searchParams, params.slug])

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
        canMakeMove={playerRole === 'both' || (game && playerRole === game.getCurrentPlayer())}
      />
      <GoGameStatus game={game} />
      <GoGameControls 
        game={game} 
        onStateChange={handleStateChange}
        onPass={handlePass}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onMarkOwnership={handleMarkOwnership}
        canMakeMove={playerRole === 'both' || (game && playerRole === game.getCurrentPlayer())}
      />
      <GoGameOver game={game} />
      <GoErrorMessage message={errorMessage || ownershipError} />
      <GoPassNotification player={passNotificationPlayer} />
      <GoClipboardNotification show={showClipboardNotification} />
      <GoInviteDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        polyhedronSlug={params.slug}
      />
      <GoPlayerRoleIndicator role={playerRole} />
      <GoSyncWarning message={syncWarning} />
      {!sessionId && (
        <button
          onClick={() => setShowInviteDialog(true)}
          className="invite-button"
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '2rem',
            background: 'rgba(102, 126, 234, 0.2)',
            border: '1px solid #667eea',
            color: '#ffffff',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'background 0.2s ease',
            fontWeight: 500,
            zIndex: 20
          }}
        >
          Invite
        </button>
      )}
      <button
        onClick={() => router.push('/')}
        className="back-to-main-button"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: 'rgba(102, 126, 234, 0.2)',
          border: '1px solid #667eea',
          color: '#ffffff',
          padding: '0.75rem 1.5rem',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '1rem',
          transition: 'background 0.2s ease',
          fontWeight: 500,
          zIndex: 20
        }}
      >
        Back to Main
      </button>
    </div>
  )
}

