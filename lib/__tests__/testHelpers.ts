/**
 * Test helpers for creating simple polyhedra/graphs for testing.
 */

/**
 * Creates a simple line graph: 0-1-2-3-4
 * Useful for testing basic moves and captures.
 */
export function createLineGraph() {
  const vertices: number[][] = [
    [0, 0, 0],
    [1, 0, 0],
    [2, 0, 0],
    [3, 0, 0],
    [4, 0, 0],
  ]
  const edges: number[][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ]
  return { vertices, edges }
}

/**
 * Creates a triangle: 0-1-2 (all connected)
 * Useful for testing groups and liberties.
 */
export function createTriangle() {
  const vertices: number[][] = [
    [0, 0, 0],
    [1, 0, 0],
    [0.5, 0.866, 0],
  ]
  const edges: number[][] = [
    [0, 1],
    [1, 2],
    [2, 0],
  ]
  return { vertices, edges }
}

/**
 * Creates a square: 0-1-2-3 (all connected in a cycle)
 */
export function createSquare() {
  const vertices: number[][] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
  ]
  const edges: number[][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ]
  return { vertices, edges }
}

/**
 * Creates a simple capture scenario: line with a branch
 *   0-1-2
 *      |
 *      3
 */
export function createCaptureScenario() {
  const vertices: number[][] = [
    [0, 0, 0],
    [1, 0, 0],
    [2, 0, 0],
    [1, 1, 0],
  ]
  const edges: number[][] = [
    [0, 1],
    [1, 2],
    [1, 3],
  ]
  return { vertices, edges }
}

/**
 * Creates a Ko scenario: two adjacent vertices
 * 0-1
 */
export function createKoScenario() {
  const vertices: number[][] = [
    [0, 0, 0],
    [1, 0, 0],
  ]
  const edges: number[][] = [
    [0, 1],
  ]
  return { vertices, edges }
}

/**
 * Helper to assert board state matches expected pattern
 */
export function assertBoardState(
  board: Map<number, 'black' | 'white' | null>,
  expected: (number | null)[]
) {
  for (let i = 0; i < expected.length; i++) {
    const expectedColor = expected[i] === null ? null : expected[i] === 0 ? 'black' : 'white'
    const actualColor = board.get(i) ?? null
    if (actualColor !== expectedColor) {
      throw new Error(
        `Vertex ${i}: expected ${expectedColor}, got ${actualColor}`
      )
    }
  }
}

