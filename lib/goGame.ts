/**
 * Go Game implementation for polyhedron boards.
 * 
 * This module contains the core game logic including move validation,
 * capture detection, Ko rule enforcement, and game state management.
 */

export type StoneColor = 'black' | 'white'
export type VertexState = StoneColor | null | 'white_owned' | 'black_owned' | 'unowned'

/**
 * Represents a single move in the game.
 * Stores the move details and board state snapshots for undo/redo functionality.
 */
export class Move {
  /** Vertex index where stone was placed, or null if this was a pass */
  readonly vertexIndex: number | null
  
  /** Color of the stone placed (or player who passed) */
  readonly color: StoneColor
  
  /** Initial vertices of opponent groups that were captured by this move */
  readonly captures: number[]
  
  /** Board state before this move was made */
  readonly boardBefore: Map<number, VertexState>
  
  /** Board state after this move was made */
  readonly boardAfter: Map<number, VertexState>
  
  /** Hash of the board state after this move (for Ko rule detection) */
  readonly boardHash: string

  constructor(
    vertexIndex: number | null,
    color: StoneColor,
    captures: number[],
    boardBefore: Map<number, VertexState>,
    boardAfter: Map<number, VertexState>,
    boardHash: string
  ) {
    this.vertexIndex = vertexIndex
    this.color = color
    this.captures = captures
    this.boardBefore = boardBefore
    this.boardAfter = boardAfter
    this.boardHash = boardHash
  }
}

/**
 * Result of a move validation check.
 */
export interface MoveValidationResult {
  /** Whether the move is legal */
  legal: boolean
  
  /** Reason why the move is illegal (if legal is false) */
  reason?: string
}

/**
 * Serialized move for transmission (without large board snapshots).
 */
export interface SerializedMove {
  vertexIndex: number | null
  color: StoneColor
  captures: number[]
  boardHash: string
}

/**
 * Serialized game state for transmission.
 */
export interface GameState {
  board: Record<number, VertexState>
  moveHistory: SerializedMove[]
  currentPlayer: StoneColor
  gameOver: boolean
  consecutivePasses: number
  lastPlayedVertex: number | null
}

/**
 * Main Go game class.
 * Manages game state, validates moves, handles captures, and enforces rules.
 */
export class GoGame {
  /** Current board state: vertex index -> vertex state (stone color, ownership, or empty) */
  private board: Map<number, VertexState>
  
  /** Vertex positions (immutable) */
  private readonly vertices: number[][]
  
  /** Edge connections (immutable) */
  private readonly edges: number[][]
  
  /** Pre-computed adjacency map: vertex index -> array of neighbor indices */
  private readonly adjacencyMap: Map<number, number[]>
  
  /** Current player to move */
  private currentPlayer: StoneColor
  
  /** History of all moves made */
  private moveHistory: Move[]
  
  /** Current position in move history (for undo/redo) */
  private historyIndex: number
  
  /** Number of consecutive passes */
  private consecutivePasses: number
  
  /** Whether the game is over */
  private gameOver: boolean
  
  /** Set of all board state hashes that have occurred (for Ko rule) */
  private boardStateHashes: Set<string>
  
  /** Last played vertex index (null if no stone has been played yet) */
  private lastPlayedVertex: number | null

  /**
   * Creates a new Go game on the given polyhedron.
   * 
   * @param vertices Array of vertex positions [x, y, z]
   * @param edges Array of edge connections [vertex1, vertex2]
   */
  constructor(vertices: number[][], edges: number[][]) {
    this.vertices = vertices
    this.edges = edges
    this.adjacencyMap = this.buildAdjacencyMap()
    
    // Initialize empty board
    this.board = new Map()
    for (let i = 0; i < vertices.length; i++) {
      this.board.set(i, null)
    }
    
    // Initialize game state
    this.currentPlayer = 'black'
    this.moveHistory = []
    this.historyIndex = -1
    this.consecutivePasses = 0
    this.gameOver = false
    this.boardStateHashes = new Set()
    this.lastPlayedVertex = null
    
    // Add initial empty board state to hash set
    const initialHash = this.serializeBoard()
    this.boardStateHashes.add(initialHash)
  }

  /**
   * Checks if a vertex state represents an actual stone (black or white).
   * Ownership states and empty vertices are not considered stones.
   * 
   * @param state Vertex state to check
   * @returns True if state is 'black' or 'white'
   */
  private isStone(state: VertexState | undefined): state is StoneColor {
    return state === 'black' || state === 'white'
  }

  /**
   * Checks if a vertex is empty (null).
   * 
   * @param state Vertex state to check
   * @returns True if state is null
   */
  private isEmpty(state: VertexState | undefined): boolean {
    return state === null
  }

  /**
   * Builds an adjacency map from the edge list.
   * Each vertex maps to an array of its neighboring vertex indices.
   * 
   * @returns Map from vertex index to array of neighbor indices
   */
  private buildAdjacencyMap(): Map<number, number[]> {
    const adj = new Map<number, number[]>()
    
    // Initialize all vertices with empty arrays
    for (let i = 0; i < this.vertices.length; i++) {
      adj.set(i, [])
    }
    
    // Add edges (bidirectional)
    for (const [v1, v2] of this.edges) {
      adj.get(v1)!.push(v2)
      adj.get(v2)!.push(v1)
    }
    
    return adj
  }

  /**
   * Serializes the current board state to a string hash.
   * Used for Ko rule detection.
   * 
   * @returns String representation of the board state
   */
  private serializeBoard(): string {
    // Convert board map to sorted array of [vertex, color] pairs
    const entries = Array.from(this.board.entries()).sort((a, b) => a[0] - b[0])
    // Serialize: "0:null,1:black,2:white,..."
    return entries.map(([v, c]) => `${v}:${c}`).join(',')
  }

  /**
   * Public method to get board hash for synchronization.
   * 
   * @returns String representation of the board state
   */
  getBoardHash(): string {
    return this.serializeBoard()
  }

  /**
   * Creates a deep copy of the current board state.
   * 
   * @returns New Map with copied board state
   */
  private createBoardSnapshot(): Map<number, VertexState> {
    return new Map(this.board)
  }

  /**
   * Restores the board to a previous snapshot.
   * 
   * @param snapshot Board state to restore
   */
  private restoreBoardSnapshot(snapshot: Map<number, VertexState>): void {
    this.board = new Map(snapshot)
  }

  /**
   * Gets all vertices connected to the given vertex that have the same color.
   * If the vertex is empty, returns all connected empty vertices.
   * Uses BFS to traverse connected components.
   * 
   * @param vertexIndex Starting vertex index
   * @param boardSnapshot Optional board snapshot to use instead of current board
   * @returns Array of vertex indices in the connected group, or empty array if vertex is empty and has no connected empty vertices
   */
  getConnected(vertexIndex: number, boardSnapshot?: Map<number, VertexState>): number[] {
    const board = boardSnapshot || this.board
    const state = board.get(vertexIndex)
    
    // If vertex is empty (null) or ownership state, return all connected empty/ownership vertices
    if (state === null || state === 'white_owned' || state === 'black_owned' || state === 'unowned') {
      const visited = new Set<number>()
      const queue: number[] = [vertexIndex]
      visited.add(vertexIndex)
      
      while (queue.length > 0) {
        const current = queue.shift()!
        const neighbors = this.adjacencyMap.get(current) || []
        
        for (const neighbor of neighbors) {
          const neighborState = board.get(neighbor)
          if (!visited.has(neighbor) && (neighborState === null || neighborState === 'white_owned' || neighborState === 'black_owned' || neighborState === 'unowned')) {
            visited.add(neighbor)
            queue.push(neighbor)
          }
        }
      }
      
      return Array.from(visited)
    }
    
    // BFS to find all connected vertices of same color (only for actual stones)
    const visited = new Set<number>()
    const queue: number[] = [vertexIndex]
    visited.add(vertexIndex)
    
    while (queue.length > 0) {
      const current = queue.shift()!
      const neighbors = this.adjacencyMap.get(current) || []
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && board.get(neighbor) === state) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    
    return Array.from(visited)
  }

  /**
   * Gets all vertices that are connected to the given list of vertices (but not in the input list).
   * Returns surrounding vertices regardless of stone color or whether they're empty.
   * 
   * @param vertexIndices Array of vertex indices to find surroundings for
   * @returns Array of vertex indices that are adjacent to the input vertices but not in the input list
   */
  getSurroundingVertices(vertexIndices: number[]): number[] {
    const inputSet = new Set(vertexIndices)
    const surroundingSet = new Set<number>()
    
    // For each vertex in the input list, add all its neighbors
    for (const vertexIndex of vertexIndices) {
      const neighbors = this.adjacencyMap.get(vertexIndex) || []
      for (const neighbor of neighbors) {
        // Only add if not in the input list
        if (!inputSet.has(neighbor)) {
          surroundingSet.add(neighbor)
        }
      }
    }
    
    return Array.from(surroundingSet)
  }

  /**
   * Counts the number of liberties (empty adjacent vertices) for a group.
   * 
   * @param vertexIndex Vertex index in the group
   * @param color Optional color to use. If provided, temporarily places a stone of that color
   *              at vertexIndex in a snapshot. If not provided, uses the existing stone's color.
   *              If color is provided and vertex is already occupied, throws an error.
   * @returns Number of liberties (empty adjacent vertices)
   */
  countLiberties(vertexIndex: number, color?: StoneColor): number {
    // Determine which board to use
    let board: Map<number, VertexState>
    let groupColor: StoneColor
    
    if (color !== undefined) {
      // Color specified - use snapshot with stone placed
      const currentState = this.board.get(vertexIndex)
      if (!this.isEmpty(currentState)) {
        throw new Error(`Vertex ${vertexIndex} is already occupied`)
      }
      board = this.createBoardSnapshot()
      board.set(vertexIndex, color)
      groupColor = color
    } else {
      // No color specified - use existing board and existing stone's color
      board = this.board
      const existingState = this.board.get(vertexIndex)
      if (!this.isStone(existingState)) {
        throw new Error(`Vertex ${vertexIndex} is empty and no color specified`)
      }
      groupColor = existingState
    }
    
    // Get the full connected group
    const group = this.getConnected(vertexIndex, board)
    
    // Collect all unique adjacent vertices
    const adjacentSet = new Set<number>()
    for (const v of group) {
      const neighbors = this.adjacencyMap.get(v) || []
      for (const neighbor of neighbors) {
        adjacentSet.add(neighbor)
      }
    }
    
    // Count how many are empty (null only, not ownership states)
    let liberties = 0
    const adjacentArray = Array.from(adjacentSet)
    for (const v of adjacentArray) {
      if (this.isEmpty(board.get(v))) {
        liberties++
      }
    }
    
    return liberties
  }

  /**
   * Checks which opponent groups adjacent to the placed stone are now dead.
   * Called after a stone has been legally placed on the board.
   * 
   * @param vertexIndex Vertex where stone was just placed
   * @returns Array of initial vertex indices of groups that are dead (empty if none)
   */
  checkLife(vertexIndex: number): number[] {
    const state = this.board.get(vertexIndex)
    if (!this.isStone(state)) {
      throw new Error(`Vertex ${vertexIndex} is empty - stone must be placed before checking life`)
    }
    
    const opponentColor: StoneColor = state === 'black' ? 'white' : 'black'
    const neighbors = this.adjacencyMap.get(vertexIndex) || []
    
    // Find all opponent groups adjacent to this vertex
    const opponentNeighbors = neighbors.filter(v => this.board.get(v) === opponentColor)
    
    // Track which groups we've already checked (by representative vertex)
    const checkedGroups = new Set<number>()
    const deadGroups: number[] = []
    
    for (const neighbor of opponentNeighbors) {
      // Get representative vertex (first vertex of the group)
      const group = this.getConnected(neighbor)
      if (group.length === 0) continue
      
      const representative = group[0]
      if (checkedGroups.has(representative)) continue
      checkedGroups.add(representative)
      
      // Count liberties of this group
      const liberties = this.countLiberties(representative)
      
      // If group has no liberties, it's dead
      if (liberties === 0) {
        deadGroups.push(representative)
      }
    }
    
    return deadGroups
  }

  /**
   * Removes stones from the board (sets to null).
   * 
   * @param vertexIndices Array of vertex indices to clear
   */
  removeStones(vertexIndices: number[]): void {
    for (const v of vertexIndices) {
      this.board.set(v, null)
    }
  }

  /**
   * Removes a group of stones by clicking on any vertex in the group.
   * Only works when the game is over.
   * Adds the removal to move history so it can be undone.
   * 
   * @param vertexIndex Vertex index in the group to remove
   * @returns True if group was removed, false if invalid or game not over
   */
  removeGroup(vertexIndex: number): boolean {
    // Only allow removing groups when game is over
    if (!this.gameOver) {
      return false
    }
    
    // Check if vertex index is valid
    if (vertexIndex < 0 || vertexIndex >= this.vertices.length) {
      return false
    }
    
    // Get the connected group
    const group = this.getConnected(vertexIndex)
    
    // If vertex is empty or ownership state, nothing to remove
    if (group.length === 0) {
      return false
    }
    
    // Check that the vertex is an actual stone (not ownership state)
    const state = this.board.get(vertexIndex)
    if (!this.isStone(state)) {
      return false // Can't remove ownership states or empty vertices
    }
    
    // Create board snapshot before removal
    const boardBefore = this.createBoardSnapshot()
    
    // Get the color of the group before removal
    const groupColor = state
    
    // Remove all stones in the group
    this.removeStones(group)
    
    // Create board snapshot after removal
    const boardAfter = this.createBoardSnapshot()
    const boardHash = this.serializeBoard()
    
    // Create move object for removal (vertexIndex is null, but we track the group)
    const move = new Move(
      null, // No stone placement, just removal
      groupColor, // Color of removed group (for reference)
      group, // Store the removed vertices as "captures"
      boardBefore,
      boardAfter,
      boardHash
    )
    
    // Add to history (truncate if we're not at the end)
    if (this.historyIndex < this.moveHistory.length - 1) {
      this.moveHistory = this.moveHistory.slice(0, this.historyIndex + 1)
    }
    this.moveHistory.push(move)
    this.historyIndex++
    
    // Add new hash to set
    this.boardStateHashes.add(boardHash)
    
    return true
  }

  /**
   * Serializes a board snapshot to a string hash.
   * 
   * @param boardSnapshot Board snapshot to serialize
   * @returns String representation of the board state
   */
  private serializeBoardSnapshot(boardSnapshot: Map<number, VertexState>): string {
    const entries = Array.from(boardSnapshot.entries()).sort((a, b) => a[0] - b[0])
    return entries.map(([v, c]) => `${v}:${c}`).join(',')
  }

  /**
   * Validates whether a move is legal.
   * Checks: vertex is empty, group has liberties, and Ko rule.
   * Uses board snapshots internally - never modifies the real board.
   * 
   * @param vertexIndex Vertex where stone would be placed
   * @returns Validation result with legal status and reason if illegal
   */
  validateMove(vertexIndex: number): MoveValidationResult {
    // Check if vertex index is valid
    if (vertexIndex < 0 || vertexIndex >= this.vertices.length) {
      return { legal: false, reason: 'Invalid vertex index' }
    }
    
    // Check if game is over
    if (this.gameOver) {
      return { legal: false, reason: 'Game is over' }
    }
    
    // Check if vertex is empty (null only - ownership states can't be played on)
    const currentState = this.board.get(vertexIndex)
    if (!this.isEmpty(currentState)) {
      return { legal: false, reason: 'Vertex is already occupied' }
    }
    
    // Create snapshot with stone placed
    const boardSnapshot = this.createBoardSnapshot()
    boardSnapshot.set(vertexIndex, this.currentPlayer)
    
    // Check if placed stone/group has liberties
    const liberties = this.countLiberties(vertexIndex, this.currentPlayer)
    if (liberties === 0) {
      // Check if this move would capture any opponent groups
      // Simulate captures in snapshot
      const opponentColor: StoneColor = this.currentPlayer === 'black' ? 'white' : 'black'
      const neighbors = this.adjacencyMap.get(vertexIndex) || []
      const opponentNeighbors = neighbors.filter(v => boardSnapshot.get(v) === opponentColor)
      
      let hasCaptures = false
      const checkedGroups = new Set<number>()
      for (const neighbor of opponentNeighbors) {
        const group = this.getConnected(neighbor, boardSnapshot)
        if (group.length === 0) continue
        
        const representative = group[0]
        if (checkedGroups.has(representative)) continue
        checkedGroups.add(representative)
        
        // Count liberties of this group in snapshot
        const groupAdjacentSet = new Set<number>()
        for (const v of group) {
          const groupNeighbors = this.adjacencyMap.get(v) || []
          for (const n of groupNeighbors) {
            groupAdjacentSet.add(n)
          }
        }
        let groupLiberties = 0
        for (const v of Array.from(groupAdjacentSet)) {
          if (this.isEmpty(boardSnapshot.get(v))) {
            groupLiberties++
          }
        }
        
        if (groupLiberties === 0) {
          hasCaptures = true
          break
        }
      }
      
      if (!hasCaptures) {
        // No captures and no liberties = suicide, illegal
        return { legal: false, reason: 'Move has no liberties and captures nothing' }
      }
    }
    
    // Simulate captures in snapshot for Ko checking
    const opponentColor: StoneColor = this.currentPlayer === 'black' ? 'white' : 'black'
    const neighbors = this.adjacencyMap.get(vertexIndex) || []
    const opponentNeighbors = neighbors.filter(v => boardSnapshot.get(v) === opponentColor)
    
    const allDeadVertices = new Set<number>()
    const checkedGroups = new Set<number>()
    for (const neighbor of opponentNeighbors) {
      const group = this.getConnected(neighbor, boardSnapshot)
      if (group.length === 0) continue
      
      const representative = group[0]
      if (checkedGroups.has(representative)) continue
      checkedGroups.add(representative)
      
      // Count liberties of this group in snapshot
      const groupAdjacentSet = new Set<number>()
      for (const v of group) {
        const groupNeighbors = this.adjacencyMap.get(v) || []
        for (const n of groupNeighbors) {
          groupAdjacentSet.add(n)
        }
      }
        let groupLiberties = 0
        for (const v of Array.from(groupAdjacentSet)) {
          if (this.isEmpty(boardSnapshot.get(v))) {
            groupLiberties++
          }
        }
        
        // If group has no liberties, mark all vertices as dead
        if (groupLiberties === 0) {
          for (const v of group) {
            allDeadVertices.add(v)
          }
        }
      }
      
      // Remove captured stones in snapshot
      const allDeadVerticesArray = Array.from(allDeadVertices)
      for (const v of allDeadVerticesArray) {
        boardSnapshot.set(v, null)
      }
    
    // Check Ko rule: has this board state occurred before?
    const snapshotHash = this.serializeBoardSnapshot(boardSnapshot)
    const allPreviousHashes = this.getAllPreviousHashes()
    if (allPreviousHashes.has(snapshotHash)) {
      return { legal: false, reason: 'Ko rule: cannot repeat previous board position' }
    }
    
    // All checks passed - move is legal
    // Note: We never modified the real board, so it's guaranteed to be in a valid state
    return { legal: true }
  }

  /**
   * Gets all previous board state hashes from move history.
   * Used for Ko rule detection.
   * 
   * @returns Set of all board state hashes that have occurred
   */
  private getAllPreviousHashes(): Set<string> {
    const hashes = new Set<string>()
    // Iterate through all moves up to current position
    for (let i = 0; i <= this.historyIndex; i++) {
      hashes.add(this.moveHistory[i].boardHash)
    }
    return hashes
  }

  /**
   * Attempts to make a move at the given vertex.
   * Validates the move and updates game state if legal.
   * 
   * @param vertexIndex Vertex where stone should be placed
   * @returns Validation result indicating success or failure with reason
   */
  makeMove(vertexIndex: number): MoveValidationResult {
    // Validate move
    const validation = this.validateMove(vertexIndex)
    if (!validation.legal) {
      return validation
    }
    
    // Create board snapshot before move
    const boardBefore = this.createBoardSnapshot()
    
    // Place stone
    this.board.set(vertexIndex, this.currentPlayer)
    
    // Check for captures
    const deadInitialVertices = this.checkLife(vertexIndex)
    const allDeadVertices = new Set<number>()
    for (const initial of deadInitialVertices) {
      const group = this.getConnected(initial)
      for (const v of group) {
        allDeadVertices.add(v)
      }
    }
    
    // Remove captured stones
    this.removeStones(Array.from(allDeadVertices))
    
    // Create board snapshot after move
    const boardAfter = this.createBoardSnapshot()
    const boardHash = this.serializeBoard()
    
    // Create move object
    const move = new Move(
      vertexIndex,
      this.currentPlayer,
      deadInitialVertices,
      boardBefore,
      boardAfter,
      boardHash
    )
    
    // Add to history (truncate if we're not at the end)
    if (this.historyIndex < this.moveHistory.length - 1) {
      this.moveHistory = this.moveHistory.slice(0, this.historyIndex + 1)
    }
    this.moveHistory.push(move)
    this.historyIndex++
    
    // Add new hash to set
    this.boardStateHashes.add(boardHash)
    
    // Update last played vertex
    this.lastPlayedVertex = vertexIndex
    
    // Switch player
    this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black'
    this.consecutivePasses = 0
    
    return { legal: true }
  }

  /**
   * Passes the current turn.
   * Two consecutive passes ends the game.
   */
  pass(): void {
    if (this.gameOver) {
      return
    }
    
    // Create board snapshot (same before and after for pass)
    const boardSnapshot = this.createBoardSnapshot()
    const boardHash = this.serializeBoard()
    
    // Create pass move
    const move = new Move(
      null,
      this.currentPlayer,
      [],
      boardSnapshot,
      boardSnapshot,
      boardHash
    )
    
    // Add to history
    if (this.historyIndex < this.moveHistory.length - 1) {
      this.moveHistory = this.moveHistory.slice(0, this.historyIndex + 1)
    }
    this.moveHistory.push(move)
    this.historyIndex++
    
    // Update consecutive passes
    this.consecutivePasses++
    if (this.consecutivePasses >= 2) {
      this.gameOver = true
    } else {
      // Switch player
      this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black'
    }
    
    // Clear last played vertex (remove aura) when passing
    this.lastPlayedVertex = null
  }

  /**
   * Undoes the last move.
   * 
   * @returns True if undo was successful, false if no moves to undo
   */
  undo(): boolean {
    if (this.historyIndex < 0) {
      return false
    }
    
    const move = this.moveHistory[this.historyIndex]
    this.restoreBoardSnapshot(move.boardBefore)
    
    // Update consecutive passes
    if (move.vertexIndex === null) {
      // Was a pass
      this.consecutivePasses = Math.max(0, this.consecutivePasses - 1)
    } else {
      this.consecutivePasses = 0
    }
    
    // Update game over status
    if (this.consecutivePasses < 2) {
      this.gameOver = false
    }
    
    // Revert player
    this.currentPlayer = move.color
    
    this.historyIndex--
    
    // Update last played vertex to the previous move's vertex (if any)
    if (this.historyIndex >= 0) {
      const previousMove = this.moveHistory[this.historyIndex]
      this.lastPlayedVertex = previousMove.vertexIndex
    } else {
      this.lastPlayedVertex = null
    }
    
    return true
  }

  /**
   * Redoes the next move in history.
   * 
   * @returns True if redo was successful, false if no moves to redo
   */
  redo(): boolean {
    if (this.historyIndex >= this.moveHistory.length - 1) {
      return false
    }
    
    this.historyIndex++
    const move = this.moveHistory[this.historyIndex]
    this.restoreBoardSnapshot(move.boardAfter)
    
    // Update consecutive passes
    if (move.vertexIndex === null) {
      this.consecutivePasses++
    } else {
      this.consecutivePasses = 0
    }
    
    // Update game over status
    if (this.consecutivePasses >= 2) {
      this.gameOver = true
    }
    
    // Update player (next player after this move)
    this.currentPlayer = move.color === 'black' ? 'white' : 'black'
    
    // Update last played vertex to the move being redone
    this.lastPlayedVertex = move.vertexIndex
    
    return true
  }

  /**
   * Resets the game to initial state.
   */
  reset(): void {
    // Clear board
    for (let i = 0; i < this.vertices.length; i++) {
      this.board.set(i, null)
    }
    
    // Reset game state
    this.currentPlayer = 'black'
    this.moveHistory = []
    this.historyIndex = -1
    this.consecutivePasses = 0
    this.gameOver = false
    this.boardStateHashes.clear()
    this.lastPlayedVertex = null
    
    // Add initial empty board state
    const initialHash = this.serializeBoard()
    this.boardStateHashes.add(initialHash)
  }

  /**
   * Gets the current board state.
   * 
   * @returns Map from vertex index to vertex state (stone color, ownership, or empty)
   */
  getBoard(): Map<number, VertexState> {
    return new Map(this.board)
  }

  /**
   * Gets the current player.
   * 
   * @returns Current player color
   */
  getCurrentPlayer(): StoneColor {
    return this.currentPlayer
  }

  /**
   * Checks if the game is over.
   * 
   * @returns True if game is over
   */
  isGameOver(): boolean {
    return this.gameOver
  }

  /**
   * Gets the number of moves made.
   * 
   * @returns Number of moves in history
   */
  getMoveCount(): number {
    return this.moveHistory.length
  }

  /**
   * Checks if undo is available.
   * 
   * @returns True if there are moves to undo
   */
  canUndo(): boolean {
    return this.historyIndex >= 0
  }

  /**
   * Checks if redo is available.
   * 
   * @returns True if there are moves to redo
   */
  canRedo(): boolean {
    return this.historyIndex < this.moveHistory.length - 1
  }

  /**
   * Gets the last played vertex index.
   * 
   * @returns Last played vertex index, or null if no stone has been played yet
   */
  getLastPlayedVertex(): number | null {
    return this.lastPlayedVertex
  }

  /**
   * Gets the count of captured stones for each player.
   * Counts stones captured by each player throughout the game history.
   * 
   * @returns Object with:
   *   - blackCaptures: number of black stones captured by white (shown in White area)
   *   - whiteCaptures: number of white stones captured by black (shown in Black area)
   */
  getCapturedCounts(): { blackCaptures: number; whiteCaptures: number } {
    // blackCaptures = black stones captured by white (displayed in White area)
    // whiteCaptures = white stones captured by black (displayed in Black area)
    let blackCaptures = 0
    let whiteCaptures = 0
    
    // Iterate through move history up to current position
    for (let i = 0; i <= this.historyIndex; i++) {
      const move = this.moveHistory[i]
      
      // Skip removals (dead stones) - only count captures during play
      if (move.vertexIndex === null) {
        continue
      }
      
      // Skip moves with no captures
      if (move.captures.length === 0) {
        continue
      }
      
      // Get board state before this move to determine captured stone colors
      const boardBefore = move.boardBefore
      
      // Count captured stones for each captured group
      for (const initialVertex of move.captures) {
        // Get the group from the board state before the move
        const group = this.getConnected(initialVertex, boardBefore)
        
        // Determine the color of the captured stones
        const capturedColor = boardBefore.get(initialVertex)
        
        if (capturedColor === 'black') {
          // Black stones were captured (by white)
          blackCaptures += group.length
        } else if (capturedColor === 'white') {
          // White stones were captured (by black)
          whiteCaptures += group.length
        }
      }
    }
    
    return { blackCaptures, whiteCaptures }
  }

  /**
   * Gets the count of dead stones removed at the end of the game.
   * Counts stones removed via removeGroup (moves where vertexIndex is null).
   * 
   * @returns Object with:
   *   - blackDead: number of black stones removed (displayed in Black area)
   *   - whiteDead: number of white stones removed (displayed in White area)
   */
  getDeadCounts(): { blackDead: number; whiteDead: number } {
    let blackDead = 0
    let whiteDead = 0
    
    // Iterate through move history up to current position
    for (let i = 0; i <= this.historyIndex; i++) {
      const move = this.moveHistory[i]
      
      // Dead stones are removals: vertexIndex is null and captures.length > 0
      if (move.vertexIndex === null && move.captures.length > 0) {
        // The captures array contains all vertices in the removed group
        // The color is stored in move.color (which is the color of the removed group)
        const removedColor = move.color
        const count = move.captures.length
        
        if (removedColor === 'black') {
          blackDead += count
        } else if (removedColor === 'white') {
          whiteDead += count
        }
      }
    }
    
    return { blackDead, whiteDead }
  }

  /**
   * Gets the count of occupied vertices (stones on the board).
   * Counts vertices with 'black' or 'white' stones (not owned territory).
   * 
   * @returns Object with:
   *   - blackOccupied: number of vertices with black stones (displayed in Black area)
   *   - whiteOccupied: number of vertices with white stones (displayed in White area)
   */
  getOccupiedCounts(): { blackOccupied: number; whiteOccupied: number } {
    let blackOccupied = 0
    let whiteOccupied = 0
    
    const board = this.getBoard()
    const states = Array.from(board.values())
    for (const state of states) {
      if (state === 'black') {
        blackOccupied++
      } else if (state === 'white') {
        whiteOccupied++
      }
    }
    
    return { blackOccupied, whiteOccupied }
  }

  /**
   * Gets the count of controlled vertices (owned territory).
   * Counts vertices with black_owned or white_owned state on the current board.
   * 
   * @returns Object with:
   *   - blackControlled: number of black_owned vertices (displayed in Black area)
   *   - whiteControlled: number of white_owned vertices (displayed in White area)
   */
  getControlledCounts(): { blackControlled: number; whiteControlled: number } {
    let blackControlled = 0
    let whiteControlled = 0
    
    const board = this.getBoard()
    const states = Array.from(board.values())
    for (const state of states) {
      if (state === 'black_owned') {
        blackControlled++
      } else if (state === 'white_owned') {
        whiteControlled++
      }
    }
    
    return { blackControlled, whiteControlled }
  }

  /**
   * Gets the count of uncontrolled vertices (unowned/dame points).
   * Counts vertices with 'unowned' state on the current board.
   * 
   * @returns Number of unowned vertices
   */
  getUncontrolledCount(): number {
    let uncontrolled = 0
    
    const board = this.getBoard()
    const states = Array.from(board.values())
    for (const state of states) {
      if (state === 'unowned') {
        uncontrolled++
      }
    }
    
    return uncontrolled
  }

  /**
   * Determines ownership of empty spaces on the board.
   * Returns a map of vertex indices to their ownership state.
   * 
   * @returns Map from vertex index to ownership state ('white_owned', 'black_owned', 'unowned', or error info)
   * @throws Error if invalid state detected (empty vertices surrounded by empty/owned vertices)
   */
  determineOwnership(): Map<number, VertexState> {
    const ownership = new Map<number, VertexState>()
    const board = this.getBoard()
    const processed = new Set<number>()
    
    // Find all empty vertices (null only, not ownership states)
    const emptyVertices: number[] = []
    for (let i = 0; i < this.vertices.length; i++) {
      if (this.isEmpty(board.get(i))) {
        emptyVertices.push(i)
      }
    }
    
    // Process each connected group of empty vertices
    for (const emptyVertex of emptyVertices) {
      if (processed.has(emptyVertex)) {
        continue
      }
      
      // Get all connected empty vertices
      const emptyGroup = this.getConnected(emptyVertex)
      
      // Mark as processed
      for (const v of emptyGroup) {
        processed.add(v)
      }
      
      // Get surrounding vertices
      const surrounding = this.getSurroundingVertices(emptyGroup)
      
      // Collect stone colors from surrounding vertices
      const surroundingColors = new Set<StoneColor | null>()
      for (const v of surrounding) {
        const color = board.get(v)
        // Handle undefined (shouldn't happen, but TypeScript doesn't know that)
        if (color === undefined) {
          continue
        }
        // Only add valid StoneColor or null
        if (color === 'black' || color === 'white' || color === null) {
          surroundingColors.add(color)
        }
      }
      
      // Check for errors: surrounding vertices should only contain 'black' or 'white' (not null)
      // If we have null in surrounding, it means empty vertices are adjacent, which is an error
      const hasInvalidState = surroundingColors.has(null)
      
      if (hasInvalidState) {
        // Error: invalid state detected
        // Return error info - we'll handle this in the UI
        for (const v of emptyGroup) {
          ownership.set(v, 'unowned') // Default to unowned on error, but UI should show error
        }
        continue
      }
      
      // Determine ownership based on surrounding colors
      const hasBlack = surroundingColors.has('black')
      const hasWhite = surroundingColors.has('white')
      
      let ownershipState: VertexState
      if (hasBlack && hasWhite) {
        // Mixed colors - unowned (dame)
        ownershipState = 'unowned'
      } else if (hasBlack && !hasWhite) {
        // Only black - owned by black
        ownershipState = 'black_owned'
      } else if (hasWhite && !hasBlack) {
        // Only white - owned by white
        ownershipState = 'white_owned'
      } else {
        // No surrounding stones - unowned (shouldn't happen in normal play, but handle gracefully)
        ownershipState = 'unowned'
      }
      
      // Set ownership for all vertices in the group
      for (const v of emptyGroup) {
        ownership.set(v, ownershipState)
      }
    }
    
    return ownership
  }

  /**
   * Gets ownership information for all empty vertices.
   * Returns both the ownership map and any errors detected.
   * 
   * @returns Object with ownership map and error information
   */
  getOwnershipInfo(): { ownership: Map<number, VertexState>, hasError: boolean, errorMessage?: string } {
    const board = this.getBoard()
    const ownership = new Map<number, VertexState>()
    const processed = new Set<number>()
    let hasError = false
    let errorMessage: string | undefined
    
    // Find all empty vertices (null only, not ownership states)
    const emptyVertices: number[] = []
    for (let i = 0; i < this.vertices.length; i++) {
      if (this.isEmpty(board.get(i))) {
        emptyVertices.push(i)
      }
    }
    
    // Process each connected group of empty vertices
    for (const emptyVertex of emptyVertices) {
      if (processed.has(emptyVertex)) {
        continue
      }
      
      // Get all connected empty vertices
      const emptyGroup = this.getConnected(emptyVertex)
      
      // Mark as processed
      for (const v of emptyGroup) {
        processed.add(v)
      }
      
      // Get surrounding vertices
      const surrounding = this.getSurroundingVertices(emptyGroup)
      
      // Collect stone colors from surrounding vertices
      const surroundingColors = new Set<StoneColor | null>()
      const invalidVertices: number[] = []
      for (const v of surrounding) {
        const color = board.get(v)
        // Handle undefined (shouldn't happen, but TypeScript doesn't know that)
        if (color === undefined) {
          invalidVertices.push(v)
          continue
        }
        // If surrounding vertex is empty (null), that's an error - empty vertices shouldn't be adjacent to other empty vertices
        if (color === null) {
          invalidVertices.push(v)
        }
        // Only add valid StoneColor or null
        if (color === 'black' || color === 'white' || color === null) {
          surroundingColors.add(color)
        }
      }
      
      // Check for errors
      if (invalidVertices.length > 0) {
        hasError = true
        errorMessage = `Invalid ownership state: empty vertices at ${emptyGroup.join(', ')} are surrounded by empty vertices at ${invalidVertices.join(', ')}. All dead stones must be removed before determining ownership.`
        // Mark as unowned but error will be shown in UI
        for (const v of emptyGroup) {
          ownership.set(v, 'unowned')
        }
        continue
      }
      
      // Determine ownership based on surrounding colors
      const hasBlack = surroundingColors.has('black')
      const hasWhite = surroundingColors.has('white')
      
      let ownershipState: VertexState
      if (hasBlack && hasWhite) {
        ownershipState = 'unowned'
      } else if (hasBlack && !hasWhite) {
        ownershipState = 'black_owned'
      } else if (hasWhite && !hasBlack) {
        ownershipState = 'white_owned'
      } else {
        ownershipState = 'unowned'
      }
      
      // Set ownership for all vertices in the group
      for (const v of emptyGroup) {
        ownership.set(v, ownershipState)
      }
    }
    
    return { ownership, hasError, errorMessage }
  }

  /**
   * Marks ownership of all empty vertices on the board.
   * Converts all null vertices to ownership states (white_owned, black_owned, or unowned).
   * This should only be called after all dead stones have been removed.
   * Adds the ownership marking to move history so it can be undone/redone.
   * 
   * @returns True if ownership was marked successfully, false if there are errors
   */
  markOwnership(): boolean {
    // Only allow marking ownership when game is over
    if (!this.gameOver) {
      return false
    }

    // Get ownership information
    const ownershipInfo = this.getOwnershipInfo()
    
    // If there are errors, don't mark ownership
    if (ownershipInfo.hasError) {
      return false
    }

    const ownership = ownershipInfo.ownership
    
    // Check if there are any empty vertices to mark
    if (ownership.size === 0) {
      return false // No empty vertices to mark
    }

    // Create board snapshot before marking ownership
    const boardBefore = this.createBoardSnapshot()
    
    // Apply ownership to all empty vertices
    ownership.forEach((ownershipState, vertexIndex) => {
      this.board.set(vertexIndex, ownershipState)
    })
    
    // Create board snapshot after marking ownership
    const boardAfter = this.createBoardSnapshot()
    const boardHash = this.serializeBoard()
    
    // Create move object for ownership marking
    const move = new Move(
      null, // No stone placement, just ownership marking
      this.currentPlayer, // Use current player (doesn't matter for ownership)
      [], // No captures
      boardBefore,
      boardAfter,
      boardHash
    )
    
    // Add to history (truncate if we're not at the end)
    if (this.historyIndex < this.moveHistory.length - 1) {
      this.moveHistory = this.moveHistory.slice(0, this.historyIndex + 1)
    }
    this.moveHistory.push(move)
    this.historyIndex++
    
    // Add new hash to set
    this.boardStateHashes.add(boardHash)
    
    return true
  }

  /**
   * Serializes the current game state for transmission.
   * 
   * @returns Serialized game state
   */
  serialize(): GameState {
    return {
      board: Object.fromEntries(this.board),
      moveHistory: this.moveHistory.map(m => ({
        vertexIndex: m.vertexIndex,
        color: m.color,
        captures: m.captures,
        boardHash: m.boardHash
      })),
      currentPlayer: this.currentPlayer,
      gameOver: this.gameOver,
      consecutivePasses: this.consecutivePasses,
      lastPlayedVertex: this.lastPlayedVertex
    }
  }

  /**
   * Applies a serialized game state to restore game from transmission.
   * 
   * @param state Serialized game state to apply
   */
  applyState(state: GameState): void {
    // Restore board
    this.board = new Map(Object.entries(state.board).map(([k, v]) => [Number(k), v as VertexState]))
    
    // Restore move history (simplified - without boardBefore/boardAfter)
    this.moveHistory = state.moveHistory.map(m => {
      return new Move(
        m.vertexIndex,
        m.color,
        m.captures,
        new Map(), // boardBefore - not needed for sync
        new Map(), // boardAfter - not needed for sync
        m.boardHash
      )
    })
    
    // Restore other state
    this.currentPlayer = state.currentPlayer
    this.gameOver = state.gameOver
    this.consecutivePasses = state.consecutivePasses
    this.lastPlayedVertex = state.lastPlayedVertex
    
    // Recalculate history index
    this.historyIndex = this.moveHistory.length - 1
    
    // Recalculate board state hashes (for Ko rule)
    this.boardStateHashes = new Set()
    for (const move of this.moveHistory) {
      this.boardStateHashes.add(move.boardHash)
    }
    this.boardStateHashes.add(this.serializeBoard())
  }
}

