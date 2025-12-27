/**
 * Go Game implementation for polyhedron boards.
 * 
 * This module contains the core game logic including move validation,
 * capture detection, Ko rule enforcement, and game state management.
 */

export type StoneColor = 'black' | 'white'

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
  readonly boardBefore: Map<number, StoneColor | null>
  
  /** Board state after this move was made */
  readonly boardAfter: Map<number, StoneColor | null>
  
  /** Hash of the board state after this move (for Ko rule detection) */
  readonly boardHash: string

  constructor(
    vertexIndex: number | null,
    color: StoneColor,
    captures: number[],
    boardBefore: Map<number, StoneColor | null>,
    boardAfter: Map<number, StoneColor | null>,
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
 * Main Go game class.
 * Manages game state, validates moves, handles captures, and enforces rules.
 */
export class GoGame {
  /** Current board state: vertex index -> stone color or null */
  private board: Map<number, StoneColor | null>
  
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
   * Creates a deep copy of the current board state.
   * 
   * @returns New Map with copied board state
   */
  private createBoardSnapshot(): Map<number, StoneColor | null> {
    return new Map(this.board)
  }

  /**
   * Restores the board to a previous snapshot.
   * 
   * @param snapshot Board state to restore
   */
  private restoreBoardSnapshot(snapshot: Map<number, StoneColor | null>): void {
    this.board = new Map(snapshot)
  }

  /**
   * Gets all vertices connected to the given vertex that have the same color.
   * Uses BFS to traverse connected components.
   * 
   * @param vertexIndex Starting vertex index
   * @param boardSnapshot Optional board snapshot to use instead of current board
   * @returns Array of vertex indices in the connected group, or empty array if vertex is empty
   */
  getConnected(vertexIndex: number, boardSnapshot?: Map<number, StoneColor | null>): number[] {
    const board = boardSnapshot || this.board
    const color = board.get(vertexIndex)
    
    // If vertex is empty, return empty array
    if (color === null) {
      return []
    }
    
    // BFS to find all connected vertices of same color
    const visited = new Set<number>()
    const queue: number[] = [vertexIndex]
    visited.add(vertexIndex)
    
    while (queue.length > 0) {
      const current = queue.shift()!
      const neighbors = this.adjacencyMap.get(current) || []
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && board.get(neighbor) === color) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    
    return Array.from(visited)
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
    let board: Map<number, StoneColor | null>
    let groupColor: StoneColor
    
    if (color !== undefined) {
      // Color specified - use snapshot with stone placed
      if (this.board.get(vertexIndex) !== null) {
        throw new Error(`Vertex ${vertexIndex} is already occupied`)
      }
      board = this.createBoardSnapshot()
      board.set(vertexIndex, color)
      groupColor = color
    } else {
      // No color specified - use existing board and existing stone's color
      board = this.board
      const existingColor = this.board.get(vertexIndex)
      if (existingColor === null) {
        throw new Error(`Vertex ${vertexIndex} is empty and no color specified`)
      }
      groupColor = existingColor as StoneColor // Safe because we checked it's not null
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
    
    // Count how many are empty
    let liberties = 0
    const adjacentArray = Array.from(adjacentSet)
    for (const v of adjacentArray) {
      if (board.get(v) === null) {
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
    const stoneColor = this.board.get(vertexIndex)
    if (stoneColor === null) {
      throw new Error(`Vertex ${vertexIndex} is empty - stone must be placed before checking life`)
    }
    
    const opponentColor: StoneColor = stoneColor === 'black' ? 'white' : 'black'
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
   * Removes stones from the board.
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
    
    // If vertex is empty, nothing to remove
    if (group.length === 0) {
      return false
    }
    
    // Create board snapshot before removal
    const boardBefore = this.createBoardSnapshot()
    
    // Get the color of the group before removal
    const groupColor = boardBefore.get(vertexIndex) as StoneColor
    
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
  private serializeBoardSnapshot(boardSnapshot: Map<number, StoneColor | null>): string {
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
    
    // Check if vertex is empty
    if (this.board.get(vertexIndex) !== null) {
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
          if (boardSnapshot.get(v) === null) {
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
        if (boardSnapshot.get(v) === null) {
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
   * @returns Map from vertex index to stone color or null
   */
  getBoard(): Map<number, StoneColor | null> {
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
}

