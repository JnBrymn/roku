import * as THREE from 'three'

export interface PolyhedronData {
  vertices: number[][]
  edges: number[][]
  midradius?: number
}

export function parsePolyhedronData(text: string): PolyhedronData {
  const lines = text.trim().split('\n')
  const vertices: number[][] = []
  const edges: number[][] = []
  let midradius: number | undefined = undefined
  
  let section: string | null = null
  
  for (const line of lines) {
    if (line.startsWith('VERTICES:')) {
      section = 'vertices'
      continue
    } else if (line.startsWith('EDGES:')) {
      section = 'edges'
      continue
    } else if (line.startsWith('MIDRADIUS:')) {
      section = 'midradius'
      continue
    }
    
    if (line.trim() === '') continue
    
    if (section === 'vertices') {
      const match = line.match(/^\d+:([-\d.]+),([-\d.]+),([-\d.]+)$/)
      if (match) {
        vertices.push([
          parseFloat(match[1]),
          parseFloat(match[2]),
          parseFloat(match[3])
        ])
      }
    } else if (section === 'edges') {
      const match = line.match(/^\d+:(\d+),(\d+)$/)
      if (match) {
        edges.push([
          parseInt(match[1]),
          parseInt(match[2])
        ])
      }
    } else if (section === 'midradius') {
      const match = line.match(/^([\d.]+)$/)
      if (match) {
        midradius = parseFloat(match[1])
      }
    }
  }
  
  return { vertices, edges, midradius }
}

export function createWireframeGeometry(vertices: number[][], edges: number[][]): THREE.BufferGeometry {
  // Create positions array with explicit pairs for each edge
  // Each edge needs two vertices, and we don't want to connect edges together
  const positions: number[] = []
  
  for (const [v1, v2] of edges) {
    const start = vertices[v1]
    const end = vertices[v2]
    // Push each edge as a separate pair: [x1, y1, z1, x2, y2, z2]
    positions.push(start[0], start[1], start[2], end[0], end[1], end[2])
  }
  
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

export const polyhedraData = [
  // Platonic Solids
  { file: '/data/dodecahedron.txt', name: 'Dodecahedron', slug: 'dodecahedron' },
  { file: '/data/icosahedron.txt', name: 'Icosahedron', slug: 'icosahedron' },
  // Near-miss Johnson Solids
  { file: '/data/rectified_truncated_icosahedron.txt', name: 'Rectified Truncated Icosahedron', slug: 'rectified-truncated-icosahedron' },
  { file: '/data/expanded_truncated_icosahedron.txt', name: 'Expanded Truncated Icosahedron', slug: 'expanded-truncated-icosahedron' },
  { file: '/data/snub_rectified_truncated_icosahedron.txt', name: 'Snub Rectified Truncated Icosahedron', slug: 'snub-rectified-truncated-icosahedron' },
  { file: '/data/quinto_truncated_icosahedron.txt', name: 'Quinto Truncated Icosahedron', slug: 'quinto-truncated-icosahedron' },
  { file: '/data/A10egaT.txt', name: 'Exploded Gyro Ambo Tetrahedron', slug: 'A10egaT' },
  { file: '/data/A10egaO.txt', name: 'Exploded Gyro Ambo Octahedron', slug: 'A10egaO' },
  { file: '/data/A10egaC.txt', name: 'Exploded Gyro Ambo Cube', slug: 'A10egaC' },
  { file: '/data/A10egaD.txt', name: 'Exploded Gyro Ambo Dodecahedron', slug: 'A10egaD' },
  { file: '/data/A10egaI.txt', name: 'Exploded Gyro Ambo Icosahedron', slug: 'A10egaI' },
  { file: '/data/A10beC.txt', name: 'Bevel Exploded Cube', slug: 'A10beC' },
  { file: '/data/A10beT.txt', name: 'Bevel Exploded Tetrahedron', slug: 'A10beT' },
  { file: '/data/A10beD.txt', name: 'Bevel Exploded Dodecahedron', slug: 'A10beD' },
  { file: '/data/A10eeC.txt', name: 'Exploded Exploded Cube', slug: 'A10eeC' },
  { file: '/data/A10eeI.txt', name: 'Exploded Exploded Icosahedron', slug: 'A10eeI' },
  { file: '/data/A10ooD.txt', name: 'Ortho Ortho Dodecahedron', slug: 'A10ooD' },
  { file: '/data/A10dooI.txt', name: 'Dual Ortho Ortho Icosahedron', slug: 'A10dooI' },
  { file: '/data/A10ssaaT.txt', name: 'Snub Snub Ambo Ambo Tetrahedron', slug: 'A10ssaaT' }
]

