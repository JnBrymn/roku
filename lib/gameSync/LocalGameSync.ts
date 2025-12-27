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
  MoveResult
} from './types'

/**
 * Local game synchronization adapter.
 * Implements GameSyncAdapter for local multiplayer (both players on same screen).
 * Uses internal event emitter to simulate network communication.
 */
export class LocalGameSync implements GameSyncAdapter {
  private game: GoGame
  private callbacks: Map<string, Function[]> = new Map()
  private playerRole: 'both' = 'both'

  constructor(game: GoGame) {
    this.game = game
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

  sendMove(vertexIndex: number): Promise<MoveResult> {
    const result = this.game.makeMove(vertexIndex)
    if (!result.legal) {
      return Promise.resolve({ success: false, reason: result.reason })
    }

    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    // Emit in next tick to match async behavior
    // Note: currentPlayer has already switched, so the stone placed was the opposite
    const stoneColor = this.game.getCurrentPlayer() === 'black' ? 'white' : 'black'
    setTimeout(() => {
      this.emit('move', {
        type: 'move',
        sessionId: 'local',
        move: {
          vertexIndex,
          color: stoneColor // Color of stone just placed
        },
        gameState: state,
        boardHash: hash
      } as MoveMessage)
      this.emit('state_change')
    }, 0)

    return Promise.resolve({ success: true })
  }

  sendPass(): Promise<MoveResult> {
    this.game.pass()
    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    setTimeout(() => {
      this.emit('pass', {
        type: 'pass',
        sessionId: 'local',
        gameState: state,
        boardHash: hash
      } as PassMessage)
      this.emit('state_change')
    }, 0)

    return Promise.resolve({ success: true })
  }

  sendUndo(): Promise<MoveResult> {
    const success = this.game.undo()
    if (!success) {
      return Promise.resolve({ success: false, reason: 'Cannot undo' })
    }

    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    setTimeout(() => {
      this.emit('undo', {
        type: 'undo',
        sessionId: 'local',
        gameState: state,
        boardHash: hash
      } as UndoMessage)
      this.emit('state_change')
    }, 0)

    return Promise.resolve({ success: true })
  }

  sendRedo(): Promise<MoveResult> {
    const success = this.game.redo()
    if (!success) {
      return Promise.resolve({ success: false, reason: 'Cannot redo' })
    }

    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    setTimeout(() => {
      this.emit('redo', {
        type: 'redo',
        sessionId: 'local',
        gameState: state,
        boardHash: hash
      } as RedoMessage)
      this.emit('state_change')
    }, 0)

    return Promise.resolve({ success: true })
  }

  sendRemoveGroup(vertexIndex: number): Promise<MoveResult> {
    const success = this.game.removeGroup(vertexIndex)
    if (!success) {
      return Promise.resolve({ success: false, reason: 'Cannot remove group' })
    }

    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    setTimeout(() => {
      this.emit('remove_group', {
        type: 'remove_group',
        sessionId: 'local',
        vertexIndex,
        gameState: state,
        boardHash: hash
      } as RemoveGroupMessage)
      this.emit('state_change')
    }, 0)

    return Promise.resolve({ success: true })
  }

  sendMarkOwnership(): Promise<MoveResult> {
    const success = this.game.markOwnership()
    if (!success) {
      return Promise.resolve({ success: false, reason: 'Cannot mark ownership' })
    }

    const state = this.game.serialize()
    const hash = this.game.getBoardHash()

    setTimeout(() => {
      this.emit('mark_ownership', {
        type: 'mark_ownership',
        sessionId: 'local',
        gameState: state,
        boardHash: hash
      } as MarkOwnershipMessage)
      this.emit('state_change')
    }, 0)

    return Promise.resolve({ success: true })
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
    // In local mode, sync is immediate - just emit current state
    const state = this.game.serialize()
    const hash = this.game.getBoardHash()
    setTimeout(() => {
      this.emit('sync_response', {
        type: 'sync_response',
        sessionId: 'local',
        gameState: state,
        boardHash: hash
      } as SyncResponseMessage)
    }, 0)
  }

  disconnect(): void {
    this.callbacks.clear()
  }
}

