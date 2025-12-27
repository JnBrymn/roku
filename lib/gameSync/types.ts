import { StoneColor, GameState } from '../goGame'

/**
 * Result of a sync operation.
 */
export interface MoveResult {
  success: boolean
  reason?: string
}

/**
 * Base message structure for all game messages.
 */
export interface BaseMessage {
  type: string
  sessionId: string
}

/**
 * Move message - sent when a player places a stone.
 */
export interface MoveMessage extends BaseMessage {
  type: 'move'
  move: {
    vertexIndex: number
    color: StoneColor
  }
  gameState: GameState
  boardHash: string
}

/**
 * Pass message - sent when a player passes.
 */
export interface PassMessage extends BaseMessage {
  type: 'pass'
  gameState: GameState
  boardHash: string
}

/**
 * Undo message - sent when a player undos.
 */
export interface UndoMessage extends BaseMessage {
  type: 'undo'
  gameState: GameState
  boardHash: string
}

/**
 * Redo message - sent when a player redos.
 */
export interface RedoMessage extends BaseMessage {
  type: 'redo'
  gameState: GameState
  boardHash: string
}

/**
 * Remove group message - sent when a player removes a dead group.
 */
export interface RemoveGroupMessage extends BaseMessage {
  type: 'remove_group'
  vertexIndex: number
  gameState: GameState
  boardHash: string
}

/**
 * Mark ownership message - sent when a player marks ownership after removing dead stones.
 */
export interface MarkOwnershipMessage extends BaseMessage {
  type: 'mark_ownership'
  gameState: GameState
  boardHash: string
}

/**
 * Player joined message - sent when a player joins a session.
 */
export interface PlayerJoinedMessage extends BaseMessage {
  type: 'player_joined'
  role: 'black' | 'white'
}

/**
 * Player left message - sent when a player leaves a session.
 */
export interface PlayerLeftMessage extends BaseMessage {
  type: 'player_left'
}

/**
 * Sync request message - request full state from other player.
 */
export interface SyncRequestMessage extends BaseMessage {
  type: 'sync_request'
}

/**
 * Sync response message - response with full state.
 */
export interface SyncResponseMessage extends BaseMessage {
  type: 'sync_response'
  gameState: GameState
  boardHash: string
}

/**
 * Union type of all game messages.
 */
export type GameMessage =
  | MoveMessage
  | PassMessage
  | UndoMessage
  | RedoMessage
  | RemoveGroupMessage
  | MarkOwnershipMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | SyncRequestMessage
  | SyncResponseMessage

