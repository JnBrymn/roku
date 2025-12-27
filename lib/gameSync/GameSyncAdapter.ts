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
 * Interface for game synchronization adapters.
 * Abstracts the mechanism for synchronizing game state between players.
 * Can be implemented for local multiplayer or remote multiplayer via WebSocket.
 */
export interface GameSyncAdapter {
  /**
   * Send a move to the other player (or apply locally).
   * 
   * @param vertexIndex Vertex index where stone should be placed
   * @returns Promise resolving to move result
   */
  sendMove(vertexIndex: number): Promise<MoveResult>

  /**
   * Send a pass to the other player (or apply locally).
   * 
   * @returns Promise resolving to move result
   */
  sendPass(): Promise<MoveResult>

  /**
   * Send an undo to the other player (or apply locally).
   * 
   * @returns Promise resolving to move result
   */
  sendUndo(): Promise<MoveResult>

  /**
   * Send a redo to the other player (or apply locally).
   * 
   * @returns Promise resolving to move result
   */
  sendRedo(): Promise<MoveResult>

  /**
   * Send a group removal to the other player (or apply locally).
   * 
   * @param vertexIndex Vertex index of group to remove
   * @returns Promise resolving to move result
   */
  sendRemoveGroup(vertexIndex: number): Promise<MoveResult>

  /**
   * Send ownership marking to the other player (or apply locally).
   * Called when a player clicks "Done" after removing dead stones.
   * 
   * @returns Promise resolving to move result
   */
  sendMarkOwnership(): Promise<MoveResult>

  /**
   * Subscribe to incoming move messages.
   * 
   * @param callback Callback function to handle move messages
   */
  onMove(callback: (data: MoveMessage) => void): void

  /**
   * Subscribe to incoming pass messages.
   * 
   * @param callback Callback function to handle pass messages
   */
  onPass(callback: (data: PassMessage) => void): void

  /**
   * Subscribe to incoming undo messages.
   * 
   * @param callback Callback function to handle undo messages
   */
  onUndo(callback: (data: UndoMessage) => void): void

  /**
   * Subscribe to incoming redo messages.
   * 
   * @param callback Callback function to handle redo messages
   */
  onRedo(callback: (data: RedoMessage) => void): void

  /**
   * Subscribe to incoming remove group messages.
   * 
   * @param callback Callback function to handle remove group messages
   */
  onRemoveGroup(callback: (data: RemoveGroupMessage) => void): void

  /**
   * Subscribe to incoming mark ownership messages.
   * 
   * @param callback Callback function to handle mark ownership messages
   */
  onMarkOwnership(callback: (data: MarkOwnershipMessage) => void): void

  /**
   * Subscribe to error events.
   * 
   * @param callback Callback function to handle errors
   */
  onError(callback: (error: string) => void): void

  /**
   * Subscribe to hash mismatch warnings.
   * 
   * @param callback Callback function to handle hash mismatches
   */
  onHashMismatch(callback: (warning: string) => void): void

  /**
   * Subscribe to state sync responses.
   * 
   * @param callback Callback function to handle sync responses
   */
  onStateSync(callback: (data: SyncResponseMessage) => void): void

  /**
   * Subscribe to state change events (for triggering re-renders).
   * 
   * @param callback Callback function to handle state changes
   */
  onStateChange(callback: () => void): void

  /**
   * Get current player role.
   * 
   * @returns Player role: 'black', 'white', 'both' (local), or null if not set
   */
  getPlayerRole(): 'black' | 'white' | 'both' | null

  /**
   * Request full state sync from other player.
   */
  requestSync(): void

  /**
   * Disconnect and cleanup resources.
   */
  disconnect(): void
}

