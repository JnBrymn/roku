import { GoGame } from '../goGame'
import { GameSyncAdapter } from './GameSyncAdapter'
import {
  MoveMessage,
  PassMessage,
  UndoMessage,
  RedoMessage,
  RemoveGroupMessage,
  MarkOwnershipMessage,
  SyncResponseMessage,
  SyncRequestMessage,
  GameMessage,
  MoveResult
} from './types'

/**
 * WebSocket game synchronization adapter.
 * Implements GameSyncAdapter for remote multiplayer via WebSocket.
 */
export class WebSocketGameSync implements GameSyncAdapter {
  private game: GoGame
  private ws: WebSocket | null = null
  private callbacks: Map<string, Function[]> = new Map()
  private sessionId: string
  private playerRole: 'black' | 'white'
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(game: GoGame, sessionId: string, playerRole: 'black' | 'white') {
    this.game = game
    this.sessionId = sessionId
    this.playerRole = playerRole
    this.connect()
  }

  private connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/game/${this.sessionId}`
    
    try {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        // Send player joined message
        this.send({
          type: 'player_joined',
          sessionId: this.sessionId,
          role: this.playerRole
        })
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as GameMessage
          this.handleMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
          this.emit('error', 'Failed to parse message from server')
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.emit('error', 'WebSocket connection error')
      }

      this.ws.onclose = () => {
        this.ws = null
        this.emit('error', 'Connection closed')
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts)
        }
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      this.emit('error', 'Failed to connect to server')
    }
  }

  private send(message: GameMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not open, cannot send message')
    }
  }

  private handleMessage(message: GameMessage) {
    switch (message.type) {
      case 'move':
        this.handleMove(message as MoveMessage)
        break
      case 'pass':
        this.handlePass(message as PassMessage)
        break
      case 'undo':
        this.handleUndo(message as UndoMessage)
        break
      case 'redo':
        this.handleRedo(message as RedoMessage)
        break
      case 'remove_group':
        this.handleRemoveGroup(message as RemoveGroupMessage)
        break
      case 'mark_ownership':
        this.handleMarkOwnership(message as MarkOwnershipMessage)
        break
      case 'sync_response':
        this.handleSyncResponse(message as SyncResponseMessage)
        break
      case 'sync_request':
        this.handleSyncRequest(message as SyncRequestMessage)
        break
      case 'player_joined':
        // Other player joined - could show notification
        break
      case 'player_left':
        // Other player left - could show notification
        this.emit('error', 'Other player disconnected')
        break
    }
  }

  private handleMove(message: MoveMessage) {
    // Apply move locally
    const result = this.game.makeMove(message.move.vertexIndex)

    if (!result.legal) {
      // Move was illegal - accept received state
      this.emit('error', 'Received illegal move - syncing to received state')
      this.game.applyState(message.gameState)
      this.emit('state_change')
      return
    }

    // Verify hash
    const localHash = this.game.getBoardHash()
    if (localHash !== message.boardHash) {
      // Hash mismatch - show warning and accept received state
      this.emit('hash_mismatch', 'State mismatch detected - syncing')
      this.game.applyState(message.gameState)
      this.emit('state_change')
    } else {
      // Hashes match - everything is good
      this.emit('state_change')
    }
  }

  private handlePass(message: PassMessage) {
    // Apply pass locally
    this.game.pass()

    // Verify hash
    const localHash = this.game.getBoardHash()
    if (localHash !== message.boardHash) {
      this.emit('hash_mismatch', 'State mismatch after pass - syncing')
      this.game.applyState(message.gameState)
    }
    this.emit('state_change')
  }

  private handleUndo(message: UndoMessage) {
    // Apply undo locally
    const success = this.game.undo()

    if (!success) {
      // Undo failed - accept received state
      this.emit('error', 'Undo failed locally - syncing to received state')
      this.game.applyState(message.gameState)
      this.emit('state_change')
      return
    }

    // Verify hash
    const localHash = this.game.getBoardHash()
    if (localHash !== message.boardHash) {
      this.emit('hash_mismatch', 'State mismatch after undo - syncing')
      this.game.applyState(message.gameState)
    }
    this.emit('state_change')
  }

  private handleRedo(message: RedoMessage) {
    // Apply redo locally
    const success = this.game.redo()

    if (!success) {
      // Redo failed - accept received state
      this.emit('error', 'Redo failed locally - syncing to received state')
      this.game.applyState(message.gameState)
      this.emit('state_change')
      return
    }

    // Verify hash
    const localHash = this.game.getBoardHash()
    if (localHash !== message.boardHash) {
      this.emit('hash_mismatch', 'State mismatch after redo - syncing')
      this.game.applyState(message.gameState)
    }
    this.emit('state_change')
  }

  private handleRemoveGroup(message: RemoveGroupMessage) {
    // Apply remove group locally
    const success = this.game.removeGroup(message.vertexIndex)

    if (!success) {
      // Remove failed - accept received state
      this.emit('error', 'Remove group failed locally - syncing to received state')
      this.game.applyState(message.gameState)
      this.emit('state_change')
      return
    }

    // Verify hash
    const localHash = this.game.getBoardHash()
    if (localHash !== message.boardHash) {
      this.emit('hash_mismatch', 'State mismatch after remove group - syncing')
      this.game.applyState(message.gameState)
    }
    this.emit('state_change')
  }

  private handleMarkOwnership(message: MarkOwnershipMessage) {
    // Apply mark ownership locally
    const success = this.game.markOwnership()

    if (!success) {
      // Mark ownership failed - accept received state
      this.emit('error', 'Mark ownership failed locally - syncing to received state')
      this.game.applyState(message.gameState)
      this.emit('state_change')
      return
    }

    // Verify hash
    const localHash = this.game.getBoardHash()
    if (localHash !== message.boardHash) {
      this.emit('hash_mismatch', 'State mismatch after mark ownership - syncing')
      this.game.applyState(message.gameState)
    }
    this.emit('state_change')
  }

  private handleSyncResponse(message: SyncResponseMessage) {
    // Apply received state
    this.game.applyState(message.gameState)
    this.emit('state_change')
  }

  private handleSyncRequest(message: SyncRequestMessage) {
    // Send current state to requesting player
    const state = this.game.serialize()
    const hash = this.game.getBoardHash()
    this.send({
      type: 'sync_response',
      sessionId: this.sessionId,
      gameState: state,
      boardHash: hash
    })
  }

  sendMove(vertexIndex: number): Promise<MoveResult> {
    // Apply move locally (optimistic)
    const result = this.game.makeMove(vertexIndex)
    if (!result.legal) {
      return Promise.resolve({ success: false, reason: result.reason })
    }

    // Serialize state and hash
    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    // Send message
    // Note: currentPlayer has already switched, so the stone placed was the opposite
    const stoneColor = this.game.getCurrentPlayer() === 'black' ? 'white' : 'black'
    const message: MoveMessage = {
      type: 'move',
      sessionId: this.sessionId,
      move: {
        vertexIndex,
        color: stoneColor // Color of stone just placed
      },
      gameState: state,
      boardHash: hash
    }

    this.send(message)
    return Promise.resolve({ success: true })
  }

  sendPass(): Promise<MoveResult> {
    // Apply pass locally
    this.game.pass()
    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    this.send({
      type: 'pass',
      sessionId: this.sessionId,
      gameState: state,
      boardHash: hash
    })

    return Promise.resolve({ success: true })
  }

  sendUndo(): Promise<MoveResult> {
    const success = this.game.undo()
    if (!success) {
      return Promise.resolve({ success: false, reason: 'Cannot undo' })
    }

    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    this.send({
      type: 'undo',
      sessionId: this.sessionId,
      gameState: state,
      boardHash: hash
    })

    return Promise.resolve({ success: true })
  }

  sendRedo(): Promise<MoveResult> {
    const success = this.game.redo()
    if (!success) {
      return Promise.resolve({ success: false, reason: 'Cannot redo' })
    }

    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    this.send({
      type: 'redo',
      sessionId: this.sessionId,
      gameState: state,
      boardHash: hash
    })

    return Promise.resolve({ success: true })
  }

  sendRemoveGroup(vertexIndex: number): Promise<MoveResult> {
    const success = this.game.removeGroup(vertexIndex)
    if (!success) {
      return Promise.resolve({ success: false, reason: 'Cannot remove group' })
    }

    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    this.send({
      type: 'remove_group',
      sessionId: this.sessionId,
      vertexIndex,
      gameState: state,
      boardHash: hash
    })

    return Promise.resolve({ success: true })
  }

  sendMarkOwnership(): Promise<MoveResult> {
    const success = this.game.markOwnership()
    if (!success) {
      return Promise.resolve({ success: false, reason: 'Cannot mark ownership' })
    }

    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    this.send({
      type: 'mark_ownership',
      sessionId: this.sessionId,
      gameState: state,
      boardHash: hash
    })

    return Promise.resolve({ success: true })
  }

  private emit(event: string, data?: any) {
    const handlers = this.callbacks.get(event) || []
    handlers.forEach(handler => handler(data))
  }

  private addListener(event: string, callback: Function) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, [])
    }
    this.callbacks.get(event)!.push(callback)
  }

  onMove(callback: (data: MoveMessage) => void): void {
    this.addListener('move', callback)
  }

  onPass(callback: (data: PassMessage) => void): void {
    this.addListener('pass', callback)
  }

  onUndo(callback: (data: UndoMessage) => void): void {
    this.addListener('undo', callback)
  }

  onRedo(callback: (data: RedoMessage) => void): void {
    this.addListener('redo', callback)
  }

  onRemoveGroup(callback: (data: RemoveGroupMessage) => void): void {
    this.addListener('remove_group', callback)
  }

  onMarkOwnership(callback: (data: MarkOwnershipMessage) => void): void {
    this.addListener('mark_ownership', callback)
  }

  onError(callback: (error: string) => void): void {
    this.addListener('error', callback)
  }

  onHashMismatch(callback: (warning: string) => void): void {
    this.addListener('hash_mismatch', callback)
  }

  onStateSync(callback: (data: SyncResponseMessage) => void): void {
    this.addListener('sync_response', callback)
  }

  onStateChange(callback: () => void): void {
    this.addListener('state_change', callback)
  }

  getPlayerRole(): 'black' | 'white' | 'both' | null {
    return this.playerRole
  }

  requestSync(): void {
    this.send({
      type: 'sync_request',
      sessionId: this.sessionId
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.callbacks.clear()
  }
}

