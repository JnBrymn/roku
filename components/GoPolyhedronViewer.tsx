'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { parsePolyhedronData, createWireframeGeometry } from '@/lib/polyhedronUtils'
import { GoGame, StoneColor, VertexState } from '@/lib/goGame'

// Color constants
const COLOR_EMPTY = 0xAAAAAA // Grey
const COLOR_BLACK = 0x000000
const COLOR_WHITE = 0xFFFFFF
const COLOR_UNOWNED = 0xFF0000 // Red
const COLOR_EMISSIVE_BLACK = 0x000000
const COLOR_AURA = 0xFFFF00 // Yellow

// Opacity constants
const OPACITY_EMPTY = 0.7
const OPACITY_BLACK_STONE = 1.0
const OPACITY_WHITE_STONE = 1.0
const OPACITY_BLACK_OWNED = 0.4
const OPACITY_WHITE_OWNED = 0.7
const OPACITY_UNOWNED = 0.3

// Material property constants
const EMISSIVE_INTENSITY_WHITE = 1.5
const EMISSIVE_INTENSITY_AURA = 0.8
const ROUGHNESS_EMPTY_UNOWNED = 1.0
const ROUGHNESS_STONE_OWNED = 0.3
const ROUGHNESS_INITIAL_SPHERE = 0.2
const METALNESS_DEFAULT = 0.0
const OPACITY_AURA = 0.6

interface GoPolyhedronViewerProps {
  dataFile: string
  name: string
  /** Game instance to use for move validation and state */
  game: GoGame
  /** Callback when a stone placement is attempted (vertexIndex) */
  onPlaceStone: (vertexIndex: number) => void
  /** Callback when a group removal is attempted (vertexIndex) */
  onRemoveGroup: (vertexIndex: number) => void
  /** Callback to trigger re-render when board state changes */
  onStateChange: () => void
  /** Update trigger to force re-render when game state changes */
  updateTrigger?: number
  /** Whether the current player can make moves */
  canMakeMove?: boolean
}

export default function GoPolyhedronViewer({ dataFile, name, game, onPlaceStone, onRemoveGroup, onStateChange, updateTrigger, canMakeMove = true }: GoPolyhedronViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rotationRef = useRef({ pitch: 0, yaw: 0 })
  const stonesRef = useRef<Map<number, THREE.Mesh>>(new Map())
  const clonedStonesRef = useRef<Map<number, THREE.Mesh>>(new Map())
  const auraRef = useRef<THREE.Mesh | null>(null)
  const clonedAuraRef = useRef<THREE.Mesh | null>(null)
  const vertexGroupRef = useRef<THREE.Group | null>(null)
  const clonedVertexGroupRef = useRef<THREE.Group | null>(null)
  // Mouse drag state
  const isDraggingRef = useRef(false)
  const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null)
  const mouseDownPositionRef = useRef<{ x: number; y: number } | null>(null)
  // Store callbacks in refs to prevent re-renders when they change
  const onPlaceStoneRef = useRef(onPlaceStone)
  const onRemoveGroupRef = useRef(onRemoveGroup)
  const onStateChangeRef = useRef(onStateChange)
  const gameRef = useRef(game)
  const canMakeMoveRef = useRef(canMakeMove)
  
  // Update refs when callbacks or game change
  useEffect(() => {
    onPlaceStoneRef.current = onPlaceStone
    onRemoveGroupRef.current = onRemoveGroup
    onStateChangeRef.current = onStateChange
    gameRef.current = game
    canMakeMoveRef.current = canMakeMove
  }, [onPlaceStone, onRemoveGroup, onStateChange, game, canMakeMove])
  
  /**
   * Updates sphere colors based on current game board state.
   * Called when game state changes.
   * Handles ownership states which are now stored directly in the board.
   */
  const updateSphereColors = () => {
    const board = gameRef.current.getBoard()
    
    const entries = Array.from(stonesRef.current.entries())
    for (const [vertexIndex, sphere] of entries) {
      const state = board.get(vertexIndex) ?? null
      const material = sphere.material as THREE.MeshStandardMaterial
      
      if (state === null) {
        // Empty vertex - grey (lighter) and slightly transparent
        material.color.setHex(COLOR_EMPTY)
        material.emissive.setHex(COLOR_EMISSIVE_BLACK)
        material.emissiveIntensity = 0
        material.metalness = METALNESS_DEFAULT
        material.roughness = ROUGHNESS_EMPTY_UNOWNED
        material.transparent = true
        material.opacity = OPACITY_EMPTY
      } else if (state === 'black') {
        // Black stone - opaque
        material.color.setHex(COLOR_BLACK)
        material.emissive.setHex(COLOR_EMISSIVE_BLACK)
        material.emissiveIntensity = 0
        material.metalness = METALNESS_DEFAULT
        material.roughness = ROUGHNESS_STONE_OWNED
        material.transparent = false
        material.opacity = OPACITY_BLACK_STONE
      } else if (state === 'white') {
        // White stone - bright white to show specularity, opaque
        material.color.setHex(COLOR_WHITE)
        material.emissive.setHex(COLOR_EMISSIVE_BLACK)
        material.emissiveIntensity = EMISSIVE_INTENSITY_WHITE
        material.metalness = METALNESS_DEFAULT
        material.roughness = ROUGHNESS_STONE_OWNED
        material.transparent = false
        material.opacity = OPACITY_WHITE_STONE
      } else if (state === 'black_owned') {
        // Black-owned empty space - black but transparent (like void stone)
        material.color.setHex(COLOR_BLACK)
        material.emissive.setHex(COLOR_EMISSIVE_BLACK)
        material.emissiveIntensity = 0
        material.metalness = METALNESS_DEFAULT
        material.roughness = ROUGHNESS_STONE_OWNED
        material.transparent = true
        material.opacity = OPACITY_BLACK_OWNED
      } else if (state === 'white_owned') {
        // White-owned empty space - white but transparent (like void stone)
        material.color.setHex(COLOR_WHITE)
        material.emissive.setHex(COLOR_EMISSIVE_BLACK)
        material.emissiveIntensity = EMISSIVE_INTENSITY_WHITE
        material.metalness = METALNESS_DEFAULT
        material.roughness = ROUGHNESS_STONE_OWNED
        material.transparent = true
        material.opacity = OPACITY_WHITE_OWNED
      } else if (state === 'unowned') {
        // Unowned (dame) - red transparent
        material.color.setHex(COLOR_UNOWNED)
        material.emissive.setHex(COLOR_EMISSIVE_BLACK)
        material.emissiveIntensity = 0
        material.metalness = METALNESS_DEFAULT
        material.roughness = ROUGHNESS_EMPTY_UNOWNED
        material.transparent = true
        material.opacity = OPACITY_UNOWNED
      }
      
      // Update cloned sphere with same color
      const clonedSphere = clonedStonesRef.current.get(vertexIndex)
      if (clonedSphere) {
        const clonedMaterial = clonedSphere.material as THREE.MeshStandardMaterial
        if (state === null) {
          clonedMaterial.color.setHex(COLOR_EMPTY)
          clonedMaterial.emissive.setHex(COLOR_EMISSIVE_BLACK)
          clonedMaterial.emissiveIntensity = 0
          clonedMaterial.metalness = METALNESS_DEFAULT
          clonedMaterial.roughness = ROUGHNESS_EMPTY_UNOWNED
          clonedMaterial.transparent = true
          clonedMaterial.opacity = OPACITY_EMPTY
        } else if (state === 'black') {
          clonedMaterial.color.setHex(COLOR_BLACK)
          clonedMaterial.emissive.setHex(COLOR_EMISSIVE_BLACK)
          clonedMaterial.emissiveIntensity = 0
          clonedMaterial.metalness = METALNESS_DEFAULT
          clonedMaterial.roughness = ROUGHNESS_STONE_OWNED
          clonedMaterial.transparent = false
          clonedMaterial.opacity = OPACITY_BLACK_STONE
        } else if (state === 'white') {
          clonedMaterial.color.setHex(COLOR_WHITE)
          clonedMaterial.emissive.setHex(COLOR_EMISSIVE_BLACK)
          clonedMaterial.emissiveIntensity = EMISSIVE_INTENSITY_WHITE
          clonedMaterial.metalness = METALNESS_DEFAULT
          clonedMaterial.roughness = ROUGHNESS_STONE_OWNED
          clonedMaterial.transparent = false
          clonedMaterial.opacity = OPACITY_WHITE_STONE
        } else if (state === 'black_owned') {
          clonedMaterial.color.setHex(COLOR_BLACK)
          clonedMaterial.emissive.setHex(COLOR_EMISSIVE_BLACK)
          clonedMaterial.emissiveIntensity = 0
          clonedMaterial.metalness = METALNESS_DEFAULT
          clonedMaterial.roughness = ROUGHNESS_STONE_OWNED
          clonedMaterial.transparent = true
          clonedMaterial.opacity = OPACITY_BLACK_OWNED
        } else if (state === 'white_owned') {
          clonedMaterial.color.setHex(COLOR_WHITE)
          clonedMaterial.emissive.setHex(COLOR_EMISSIVE_BLACK)
          clonedMaterial.emissiveIntensity = EMISSIVE_INTENSITY_WHITE
          clonedMaterial.metalness = METALNESS_DEFAULT
          clonedMaterial.roughness = ROUGHNESS_STONE_OWNED
          clonedMaterial.transparent = true
          clonedMaterial.opacity = OPACITY_WHITE_OWNED
        } else if (state === 'unowned') {
          clonedMaterial.color.setHex(COLOR_UNOWNED)
          clonedMaterial.emissive.setHex(COLOR_EMISSIVE_BLACK)
          clonedMaterial.emissiveIntensity = 0
          clonedMaterial.metalness = METALNESS_DEFAULT
          clonedMaterial.roughness = ROUGHNESS_EMPTY_UNOWNED
          clonedMaterial.transparent = true
          clonedMaterial.opacity = OPACITY_UNOWNED
        }
      }
    }
  }
  
  /**
   * Updates the yellow aura around the last played stone.
   * Removes the previous aura and adds a new one if there's a last played stone.
   */
  const updateAura = () => {
    // Remove previous aura if it exists
    if (auraRef.current) {
      const parent = auraRef.current.parent
      if (parent) {
        parent.remove(auraRef.current)
        auraRef.current.geometry.dispose()
        if (auraRef.current.material instanceof THREE.Material) {
          auraRef.current.material.dispose()
        }
      }
      auraRef.current = null
    }
    
    // Remove previous cloned aura if it exists
    if (clonedAuraRef.current) {
      const parent = clonedAuraRef.current.parent
      if (parent) {
        parent.remove(clonedAuraRef.current)
        clonedAuraRef.current.geometry.dispose()
        if (clonedAuraRef.current.material instanceof THREE.Material) {
          clonedAuraRef.current.material.dispose()
        }
      }
      clonedAuraRef.current = null
    }
    
    // Add aura to the last played stone (only if it still exists and has a stone)
    const lastPlayedIndex = gameRef.current.getLastPlayedVertex()
    if (lastPlayedIndex !== null && vertexGroupRef.current) {
      const stone = stonesRef.current.get(lastPlayedIndex)
      const board = gameRef.current.getBoard()
      const state = board.get(lastPlayedIndex)
      
      // Only add aura if the stone still exists (not removed/captured) and is an actual stone
      if (stone && (state === 'black' || state === 'white')) {
        // Create a slightly larger sphere for the aura
        const auraGeometry = new THREE.SphereGeometry(0.08, 32, 32)
        const auraMaterial = new THREE.MeshStandardMaterial({
          color: COLOR_AURA,
          emissive: COLOR_AURA,
          emissiveIntensity: EMISSIVE_INTENSITY_AURA,
          transparent: true,
          opacity: OPACITY_AURA,
          side: THREE.DoubleSide
        })
        const aura = new THREE.Mesh(auraGeometry, auraMaterial)
        
        // Position aura slightly closer to the center than the stone
        // Interpolate 25% towards the origin (center of big sphere)
        aura.position.copy(stone.position).lerp(new THREE.Vector3(0, 0, 0), 0.03)
        
        // Add aura to the vertex group
        vertexGroupRef.current.add(aura)
        auraRef.current = aura
        
        // Create cloned aura if cloned vertex group exists
        if (clonedVertexGroupRef.current) {
          const clonedStone = clonedStonesRef.current.get(lastPlayedIndex)
          if (clonedStone) {
            const cloneScale = 3.0 // Match the cloned wireframe scale
            const clonedAuraGeometry = new THREE.SphereGeometry(0.08 * cloneScale, 32, 32)
            const clonedAuraMaterial = new THREE.MeshStandardMaterial({
              color: COLOR_AURA,
              emissive: COLOR_AURA,
              emissiveIntensity: EMISSIVE_INTENSITY_AURA,
              transparent: true,
              opacity: OPACITY_AURA,
              side: THREE.DoubleSide,
              clippingPlanes: [new THREE.Plane(new THREE.Vector3(6, 6, 6).normalize().negate(), 0)]
            })
            const clonedAura = new THREE.Mesh(clonedAuraGeometry, clonedAuraMaterial)
            
            // Position cloned aura 4% further away from center than the stone
            const stoneDirection = clonedStone.position.clone().normalize()
            const stoneDistance = clonedStone.position.length()
            clonedAura.position.copy(stoneDirection.multiplyScalar(stoneDistance * 1.04))
            
            clonedVertexGroupRef.current.add(clonedAura)
            clonedAuraRef.current = clonedAura
          }
        }
      }
    }
  }

  useEffect(() => {
    if (!containerRef.current) return

    // Prevent text selection and image dragging, but allow canvas interactions
    const preventDrag = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Allow clicks on the back button
      if (target.closest('.back-button')) {
        return
      }
      // Allow all interactions on canvas (for placing stones and dragging)
      if (target.tagName === 'CANVAS') {
        return
      }
      // Prevent dragstart on other elements (like images)
      if (e.type === 'dragstart') {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const preventTouchDrag = (e: TouchEvent) => {
      // Allow touch interactions on canvas
      const target = e.target as HTMLElement
      if (target.tagName === 'CANVAS') {
        return
      }
      // Prevent other touch dragging
      if (e.type === 'touchmove') {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('dragstart', preventDrag, true)
    document.addEventListener('touchmove', preventTouchDrag, true)

    let scene: THREE.Scene
    let camera: THREE.PerspectiveCamera
    let renderer: THREE.WebGLRenderer
    let wireframe: LineSegments2 | THREE.LineSegments
    let clonedWireframe: LineSegments2 | THREE.LineSegments | null = null
    let animationId: number
    let handleResize: () => void
    let handleClick: (e: MouseEvent) => void
    let handleMouseDown: (e: MouseEvent) => void
    let handleMouseMove: (e: MouseEvent) => void
    let handleMouseUp: (e: MouseEvent) => void
    let handleMouseLeave: (e: MouseEvent) => void
    let raycaster: THREE.Raycaster
    let vertexSpheres: THREE.Mesh[] = []
    let vertexGroup: THREE.Group
    let clonedVertexGroup: THREE.Group | null = null
    let polyhedronData: { vertices: number[][], edges: number[][] }
    let midradiusSphere: THREE.Mesh | null = null
    let squareArcs: Line2[] = []

    const init = async () => {
      // Check if canvas already exists INSIDE init (right before creating renderer)
      // This prevents race conditions from async init() calls
      if (containerRef.current?.querySelector('canvas')) {
        return // Exit early - renderer already exists
      }
      // Fetch and parse data
      const response = await fetch(dataFile)
      const text = await response.text()
      const data = parsePolyhedronData(text)
      polyhedronData = data

      // Create scene
      scene = new THREE.Scene()
      scene.background = new THREE.Color(0x202020)

      // Create camera
      const width = window.innerWidth
      const height = window.innerHeight
      camera = new THREE.PerspectiveCamera(20, width / height, 0.1, 1000)
      camera.position.set(6, 6, 6)
      camera.lookAt(0, 0, 0)

      // Create renderer - double-check canvas doesn't exist (race condition protection)
      const existingCanvasCheck = containerRef.current?.querySelector('canvas')
      
      // Final guard: if canvas exists now, skip creation (another init() call already created it)
      if (existingCanvasCheck) {
        return
      }
      
      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.localClippingEnabled = true
      renderer.domElement.style.cursor = 'grab'
      containerRef.current?.appendChild(renderer.domElement)

      // Calculate the initial rotation matrix to align with screen coordinates
      // This will be applied to both wireframe and global axes
      const viewDirection = new THREE.Vector3(6, 6, 6).normalize()
      const worldUp = new THREE.Vector3(0, 1, 0)
      const right = new THREE.Vector3().crossVectors(worldUp, viewDirection).normalize()
      const screenUp = new THREE.Vector3().crossVectors(viewDirection, right).normalize()
      const initialRotationMatrix = new THREE.Matrix4()
      initialRotationMatrix.makeBasis(right, screenUp, viewDirection)
      
      // Create initial quaternion from the rotation matrix
      const initialQuaternion = new THREE.Quaternion()
      initialQuaternion.setFromRotationMatrix(initialRotationMatrix)

      // Create wireframe with thick black lines
      const geometry = createWireframeGeometry(data.vertices, data.edges)
      
      // Convert geometry to Line2 format for thick lines
      const positions: number[] = []
      const geometryAttributes = geometry.attributes.position
      for (let i = 0; i < geometryAttributes.count; i += 2) {
        const x1 = geometryAttributes.getX(i)
        const y1 = geometryAttributes.getY(i)
        const z1 = geometryAttributes.getZ(i)
        const x2 = geometryAttributes.getX(i + 1)
        const y2 = geometryAttributes.getY(i + 1)
        const z2 = geometryAttributes.getZ(i + 1)
        positions.push(x1, y1, z1, x2, y2, z2)
      }
      
      const lineGeometry = new LineSegmentsGeometry()
      lineGeometry.setPositions(positions)
      
      const lineMaterial = new LineMaterial({
        color: 0x000000,
        linewidth: 4,
        resolution: new THREE.Vector2(width, height)
      })
      
      wireframe = new LineSegments2(lineGeometry, lineMaterial)
      
      // Set initial quaternion so local axes match global axes
      wireframe.quaternion.copy(initialQuaternion)
      
      scene.add(wireframe)

      // Create a 3x scaled clone of the polyhedron (25% smaller than 4x)
      const cloneScale = 3.0
      const clonedPositions: number[] = []
      for (let i = 0; i < geometryAttributes.count; i += 2) {
        const x1 = geometryAttributes.getX(i) * cloneScale
        const y1 = geometryAttributes.getY(i) * cloneScale
        const z1 = geometryAttributes.getZ(i) * cloneScale
        const x2 = geometryAttributes.getX(i + 1) * cloneScale
        const y2 = geometryAttributes.getY(i + 1) * cloneScale
        const z2 = geometryAttributes.getZ(i + 1) * cloneScale
        clonedPositions.push(x1, y1, z1, x2, y2, z2)
      }
      
      const clonedLineGeometry = new LineSegmentsGeometry()
      clonedLineGeometry.setPositions(clonedPositions)
      
      const clonedLineMaterial = new LineMaterial({
        color: 0x000000,
        linewidth: 4,
        resolution: new THREE.Vector2(width, height),
        clippingPlanes: []
      })
      
      // Create a clipping plane to show only the front half
      // Camera is at (6, 6, 6) looking at (0, 0, 0), so direction from origin to camera is (1, 1, 1) normalized
      // We want to keep the front half, so plane normal points away from camera
      const clippingPlane = new THREE.Plane(viewDirection.clone().negate(), 0) // Plane through origin, normal away from camera
      clonedLineMaterial.clippingPlanes = [clippingPlane]
      
      clonedWireframe = new LineSegments2(clonedLineGeometry, clonedLineMaterial)
      clonedWireframe.quaternion.copy(initialQuaternion)
      scene.add(clonedWireframe)

      // Add midradius sphere at origin if midradius is defined
      // Single go board color
      // Attached to wireframe so it rotates with local axes
      if (data.midradius !== undefined) {
        const sphereGeometry = new THREE.SphereGeometry(data.midradius, 64, 64)
        
        // Simple material with go board color (light beige/tan)
        // MeshStandardMaterial with low roughness for shiny/specular finish
        const sphereMaterial = new THREE.MeshStandardMaterial({
          color: 0xD2B48C, // Light brown (tan)
          metalness: 0.0,
          roughness: 0.3 // Low roughness for shiny/specular finish
        })
        
        midradiusSphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
        // Add to wireframe so it rotates with local axes
        wireframe.add(midradiusSphere)
        
        // Add blue circle on the positive blue (Z) side at intersection with 30-degree cone
        // For a 30-degree cone (half-angle = 30° = π/6):
        // - Circle is at z = R * cos(30°) = R * √3/2
        // - Circle radius on sphere = R * sin(30°) = R * 1/2
        const coneAngle = Math.PI / 6 // 30 degrees
        const R = data.midradius
        const circleZ = R * Math.cos(coneAngle) // Z position of circle center
        const circleRadius = R * Math.sin(coneAngle) // Radius of circle on sphere surface
        
        // Create a thin ring (torus) to represent the circle on the sphere surface
        // Use a very small tube radius to make it appear as a line
        const ringGeometry = new THREE.TorusGeometry(circleRadius, 0.01, 16, 64)
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0x000080, // Dark blue
          side: THREE.DoubleSide
        })
        const blueCircle = new THREE.Mesh(ringGeometry, ringMaterial)
        
        // Position the circle at the correct Z coordinate (on positive blue side)
        // The circle lies in the XY plane, perpendicular to Z-axis
        blueCircle.position.set(0, 0, circleZ)
        
        // Add to wireframe so it rotates with the sphere
        wireframe.add(blueCircle)
        
        // Add green circle on the positive green (Y) side at intersection with 30-degree cone
        // Circle is at y = R * cos(30°) = R * √3/2
        // Circle lies in the XZ plane, perpendicular to Y-axis
        const circleY = R * Math.cos(coneAngle) // Y position of circle center
        const greenRingGeometry = new THREE.TorusGeometry(circleRadius, 0.01, 16, 64)
        const greenRingMaterial = new THREE.MeshBasicMaterial({
          color: 0x008000, // Dark green
          side: THREE.DoubleSide
        })
        const greenCircle = new THREE.Mesh(greenRingGeometry, greenRingMaterial)
        
        // Position at correct Y coordinate and rotate 90° around X-axis to lie in XZ plane
        greenCircle.position.set(0, circleY, 0)
        greenCircle.rotation.x = Math.PI / 2 // Rotate to XZ plane
        
        wireframe.add(greenCircle)
        
        // Add red circle on the positive red (X) side at intersection with 30-degree cone
        // Circle is at x = R * cos(30°) = R * √3/2
        // Circle lies in the YZ plane, perpendicular to X-axis
        const circleX = R * Math.cos(coneAngle) // X position of circle center
        const redRingGeometry = new THREE.TorusGeometry(circleRadius, 0.01, 16, 64)
        const redRingMaterial = new THREE.MeshBasicMaterial({
          color: 0x800000, // Dark red
          side: THREE.DoubleSide
        })
        const redCircle = new THREE.Mesh(redRingGeometry, redRingMaterial)
        
        // Position at correct X coordinate and rotate 90° around Y-axis to lie in YZ plane
        redCircle.position.set(circleX, 0, 0)
        redCircle.rotation.y = Math.PI / 2 // Rotate to YZ plane
        
        wireframe.add(redCircle)
        
        // Add red square on the negative X side made of 4 great arcs
        // Square vertices form a square in the YZ plane at negative X
        // Use the same circle radius to define square size
        const negativeCircleX = -R * Math.cos(coneAngle) // Negative X position
        const halfSide = circleRadius // Square half-side length (inscribed in circle)
        
        // Define 4 square vertices in YZ plane at negative X, then project onto sphere
        const projectToSphere = (x: number, y: number, z: number): THREE.Vector3 => {
          const vec = new THREE.Vector3(x, y, z)
          return vec.normalize().multiplyScalar(R)
        }
        
        // Square vertices (in YZ plane at negative X)
        const v1 = projectToSphere(negativeCircleX, -halfSide, -halfSide)
        const v2 = projectToSphere(negativeCircleX, halfSide, -halfSide)
        const v3 = projectToSphere(negativeCircleX, halfSide, halfSide)
        const v4 = projectToSphere(negativeCircleX, -halfSide, halfSide)
        
        // Helper function to create great arc points between two vertices on sphere
        // Uses spherical linear interpolation (slerp) to follow the great circle path
        const createGreatArc = (start: THREE.Vector3, end: THREE.Vector3, segments: number = 64): THREE.Vector3[] => {
          const points: THREE.Vector3[] = []
          
          // Normalize to ensure they're on the sphere
          const startNorm = start.clone().normalize()
          const endNorm = end.clone().normalize()
          
          // Calculate the angle between the two vectors
          const angle = startNorm.angleTo(endNorm)
          
          // Create points along the great arc using spherical linear interpolation
          for (let i = 0; i <= segments; i++) {
            const t = i / segments
            // Spherical linear interpolation (slerp)
            const sinAngle = Math.sin(angle)
            if (Math.abs(sinAngle) < 1e-6) {
              // Points are nearly identical or opposite
              points.push(startNorm.clone().multiplyScalar(R))
            } else {
              const w1 = Math.sin((1 - t) * angle) / sinAngle
              const w2 = Math.sin(t * angle) / sinAngle
              const point = new THREE.Vector3()
                .addScaledVector(startNorm, w1)
                .addScaledVector(endNorm, w2)
              // Normalize and scale to sphere radius
              point.normalize().multiplyScalar(R)
              points.push(point)
            }
          }
          
          return points
        }
        
        // Create 4 great arcs for the square edges
        const arc1Points = createGreatArc(v1, v2) // Bottom edge
        const arc2Points = createGreatArc(v2, v3) // Right edge
        const arc3Points = createGreatArc(v3, v4) // Top edge
        const arc4Points = createGreatArc(v4, v1) // Left edge
        
        // Create geometries and lines for each arc using Line2 for thick lines
        const createArcLine = (points: THREE.Vector3[], color: number) => {
          // Convert points to flat array for LineGeometry
          const positions: number[] = []
          for (const point of points) {
            positions.push(point.x, point.y, point.z)
          }
          
          const lineGeometry = new LineGeometry()
          lineGeometry.setPositions(positions)
          
          const lineMaterial = new LineMaterial({
            color: color,
            linewidth: 8, // Thick line
            resolution: new THREE.Vector2(width, height)
          })
          
          return new Line2(lineGeometry, lineMaterial)
        }
        
        const squareArc1 = createArcLine(arc1Points, 0x800000) // Dark red
        const squareArc2 = createArcLine(arc2Points, 0x800000) // Dark red
        const squareArc3 = createArcLine(arc3Points, 0x800000) // Dark red
        const squareArc4 = createArcLine(arc4Points, 0x800000) // Dark red
        
        squareArcs = [squareArc1, squareArc2, squareArc3, squareArc4]
        
        wireframe.add(squareArc1)
        wireframe.add(squareArc2)
        wireframe.add(squareArc3)
        wireframe.add(squareArc4)
        
        // Add blue square on the negative Z side made of 4 great arcs
        // Square vertices form a square in the XY plane at negative Z
        const negativeCircleZ = -R * Math.cos(coneAngle) // Negative Z position
        
        // Square vertices (in XY plane at negative Z)
        const blueV1 = projectToSphere(-halfSide, -halfSide, negativeCircleZ)
        const blueV2 = projectToSphere(halfSide, -halfSide, negativeCircleZ)
        const blueV3 = projectToSphere(halfSide, halfSide, negativeCircleZ)
        const blueV4 = projectToSphere(-halfSide, halfSide, negativeCircleZ)
        
        // Create 4 great arcs for the blue square edges
        const blueArc1Points = createGreatArc(blueV1, blueV2) // Bottom edge
        const blueArc2Points = createGreatArc(blueV2, blueV3) // Right edge
        const blueArc3Points = createGreatArc(blueV3, blueV4) // Top edge
        const blueArc4Points = createGreatArc(blueV4, blueV1) // Left edge
        
        const blueSquareArc1 = createArcLine(blueArc1Points, 0x000080) // Dark blue
        const blueSquareArc2 = createArcLine(blueArc2Points, 0x000080) // Dark blue
        const blueSquareArc3 = createArcLine(blueArc3Points, 0x000080) // Dark blue
        const blueSquareArc4 = createArcLine(blueArc4Points, 0x000080) // Dark blue
        
        squareArcs.push(blueSquareArc1, blueSquareArc2, blueSquareArc3, blueSquareArc4)
        
        wireframe.add(blueSquareArc1)
        wireframe.add(blueSquareArc2)
        wireframe.add(blueSquareArc3)
        wireframe.add(blueSquareArc4)
        
        // Add green square on the negative Y side made of 4 great arcs
        // Square vertices form a square in the XZ plane at negative Y
        const negativeCircleY = -R * Math.cos(coneAngle) // Negative Y position
        
        // Square vertices (in XZ plane at negative Y)
        const greenV1 = projectToSphere(-halfSide, negativeCircleY, -halfSide)
        const greenV2 = projectToSphere(halfSide, negativeCircleY, -halfSide)
        const greenV3 = projectToSphere(halfSide, negativeCircleY, halfSide)
        const greenV4 = projectToSphere(-halfSide, negativeCircleY, halfSide)
        
        // Create 4 great arcs for the green square edges
        const greenArc1Points = createGreatArc(greenV1, greenV2) // Bottom edge
        const greenArc2Points = createGreatArc(greenV2, greenV3) // Right edge
        const greenArc3Points = createGreatArc(greenV3, greenV4) // Top edge
        const greenArc4Points = createGreatArc(greenV4, greenV1) // Left edge
        
        const greenSquareArc1 = createArcLine(greenArc1Points, 0x008000) // Dark green
        const greenSquareArc2 = createArcLine(greenArc2Points, 0x008000) // Dark green
        const greenSquareArc3 = createArcLine(greenArc3Points, 0x008000) // Dark green
        const greenSquareArc4 = createArcLine(greenArc4Points, 0x008000) // Dark green
        
        squareArcs.push(greenSquareArc1, greenSquareArc2, greenSquareArc3, greenSquareArc4)
        
        wireframe.add(greenSquareArc1)
        wireframe.add(greenSquareArc2)
        wireframe.add(greenSquareArc3)
        wireframe.add(greenSquareArc4)

        // Clone decorative elements (circles and squares) at 2x scale
        const clonedR = R * cloneScale

        // Create clipping plane for cloned elements (same as wireframe)
        const clonedClippingPlane = new THREE.Plane(viewDirection.clone().negate(), 0)

        // Clone blue circle
        const clonedCircleZ = clonedR * Math.cos(coneAngle)
        const clonedCircleRadius = clonedR * Math.sin(coneAngle)
        const clonedBlueRingGeometry = new THREE.TorusGeometry(clonedCircleRadius, 0.01, 16, 64)
        const clonedBlueCircleMaterial = ringMaterial.clone() as THREE.MeshBasicMaterial
        clonedBlueCircleMaterial.clippingPlanes = [clonedClippingPlane]
        const clonedBlueCircle = new THREE.Mesh(clonedBlueRingGeometry, clonedBlueCircleMaterial)
        clonedBlueCircle.position.set(0, 0, clonedCircleZ)
        clonedWireframe.add(clonedBlueCircle)

        // Clone green circle
        const clonedCircleY = clonedR * Math.cos(coneAngle)
        const clonedGreenRingGeometry = new THREE.TorusGeometry(clonedCircleRadius, 0.01, 16, 64)
        const clonedGreenCircleMaterial = greenRingMaterial.clone() as THREE.MeshBasicMaterial
        clonedGreenCircleMaterial.clippingPlanes = [clonedClippingPlane]
        const clonedGreenCircle = new THREE.Mesh(clonedGreenRingGeometry, clonedGreenCircleMaterial)
        clonedGreenCircle.position.set(0, clonedCircleY, 0)
        clonedGreenCircle.rotation.x = Math.PI / 2
        clonedWireframe.add(clonedGreenCircle)

        // Clone red circle
        const clonedCircleX = clonedR * Math.cos(coneAngle)
        const clonedRedRingGeometry = new THREE.TorusGeometry(clonedCircleRadius, 0.01, 16, 64)
        const clonedRedCircleMaterial = redRingMaterial.clone() as THREE.MeshBasicMaterial
        clonedRedCircleMaterial.clippingPlanes = [clonedClippingPlane]
        const clonedRedCircle = new THREE.Mesh(clonedRedRingGeometry, clonedRedCircleMaterial)
        clonedRedCircle.position.set(clonedCircleX, 0, 0)
        clonedRedCircle.rotation.y = Math.PI / 2
        clonedWireframe.add(clonedRedCircle)

        // Clone red square
        const clonedNegativeCircleX = -clonedR * Math.cos(coneAngle)
        const clonedHalfSide = clonedCircleRadius
        const clonedProjectToSphere = (x: number, y: number, z: number): THREE.Vector3 => {
          const vec = new THREE.Vector3(x, y, z)
          return vec.normalize().multiplyScalar(clonedR)
        }
        const clonedV1 = clonedProjectToSphere(clonedNegativeCircleX, -clonedHalfSide, -clonedHalfSide)
        const clonedV2 = clonedProjectToSphere(clonedNegativeCircleX, clonedHalfSide, -clonedHalfSide)
        const clonedV3 = clonedProjectToSphere(clonedNegativeCircleX, clonedHalfSide, clonedHalfSide)
        const clonedV4 = clonedProjectToSphere(clonedNegativeCircleX, -clonedHalfSide, clonedHalfSide)

        // Create great arc function for cloned radius
        const createClonedGreatArc = (start: THREE.Vector3, end: THREE.Vector3, segments: number = 64): THREE.Vector3[] => {
          const points: THREE.Vector3[] = []
          const startNorm = start.clone().normalize()
          const endNorm = end.clone().normalize()
          const angle = startNorm.angleTo(endNorm)
          for (let i = 0; i <= segments; i++) {
            const t = i / segments
            const sinAngle = Math.sin(angle)
            if (Math.abs(sinAngle) < 1e-6) {
              points.push(startNorm.clone().multiplyScalar(clonedR))
            } else {
              const w1 = Math.sin((1 - t) * angle) / sinAngle
              const w2 = Math.sin(t * angle) / sinAngle
              const point = new THREE.Vector3()
                .addScaledVector(startNorm, w1)
                .addScaledVector(endNorm, w2)
              point.normalize().multiplyScalar(clonedR)
              points.push(point)
            }
          }
          return points
        }

        const clonedArc1Points = createClonedGreatArc(clonedV1, clonedV2)
        const clonedArc2Points = createClonedGreatArc(clonedV2, clonedV3)
        const clonedArc3Points = createClonedGreatArc(clonedV3, clonedV4)
        const clonedArc4Points = createClonedGreatArc(clonedV4, clonedV1)

        const clonedSquareArc1 = createArcLine(clonedArc1Points, 0x800000)
        const clonedSquareArc2 = createArcLine(clonedArc2Points, 0x800000)
        const clonedSquareArc3 = createArcLine(clonedArc3Points, 0x800000)
        const clonedSquareArc4 = createArcLine(clonedArc4Points, 0x800000)

        // Apply clipping planes to cloned square arcs
        if (clonedSquareArc1.material instanceof LineMaterial) {
          clonedSquareArc1.material.clippingPlanes = [clonedClippingPlane]
        }
        if (clonedSquareArc2.material instanceof LineMaterial) {
          clonedSquareArc2.material.clippingPlanes = [clonedClippingPlane]
        }
        if (clonedSquareArc3.material instanceof LineMaterial) {
          clonedSquareArc3.material.clippingPlanes = [clonedClippingPlane]
        }
        if (clonedSquareArc4.material instanceof LineMaterial) {
          clonedSquareArc4.material.clippingPlanes = [clonedClippingPlane]
        }

        clonedWireframe.add(clonedSquareArc1)
        clonedWireframe.add(clonedSquareArc2)
        clonedWireframe.add(clonedSquareArc3)
        clonedWireframe.add(clonedSquareArc4)

        // Clone blue square
        const clonedNegativeCircleZ = -clonedR * Math.cos(coneAngle)
        const clonedBlueV1 = clonedProjectToSphere(-clonedHalfSide, -clonedHalfSide, clonedNegativeCircleZ)
        const clonedBlueV2 = clonedProjectToSphere(clonedHalfSide, -clonedHalfSide, clonedNegativeCircleZ)
        const clonedBlueV3 = clonedProjectToSphere(clonedHalfSide, clonedHalfSide, clonedNegativeCircleZ)
        const clonedBlueV4 = clonedProjectToSphere(-clonedHalfSide, clonedHalfSide, clonedNegativeCircleZ)

        const clonedBlueArc1Points = createClonedGreatArc(clonedBlueV1, clonedBlueV2)
        const clonedBlueArc2Points = createClonedGreatArc(clonedBlueV2, clonedBlueV3)
        const clonedBlueArc3Points = createClonedGreatArc(clonedBlueV3, clonedBlueV4)
        const clonedBlueArc4Points = createClonedGreatArc(clonedBlueV4, clonedBlueV1)

        const clonedBlueSquareArc1 = createArcLine(clonedBlueArc1Points, 0x000080)
        const clonedBlueSquareArc2 = createArcLine(clonedBlueArc2Points, 0x000080)
        const clonedBlueSquareArc3 = createArcLine(clonedBlueArc3Points, 0x000080)
        const clonedBlueSquareArc4 = createArcLine(clonedBlueArc4Points, 0x000080)

        // Apply clipping planes to cloned blue square arcs
        if (clonedBlueSquareArc1.material instanceof LineMaterial) {
          clonedBlueSquareArc1.material.clippingPlanes = [clonedClippingPlane]
        }
        if (clonedBlueSquareArc2.material instanceof LineMaterial) {
          clonedBlueSquareArc2.material.clippingPlanes = [clonedClippingPlane]
        }
        if (clonedBlueSquareArc3.material instanceof LineMaterial) {
          clonedBlueSquareArc3.material.clippingPlanes = [clonedClippingPlane]
        }
        if (clonedBlueSquareArc4.material instanceof LineMaterial) {
          clonedBlueSquareArc4.material.clippingPlanes = [clonedClippingPlane]
        }

        clonedWireframe.add(clonedBlueSquareArc1)
        clonedWireframe.add(clonedBlueSquareArc2)
        clonedWireframe.add(clonedBlueSquareArc3)
        clonedWireframe.add(clonedBlueSquareArc4)

        // Clone green square
        const clonedNegativeCircleY = -clonedR * Math.cos(coneAngle)
        const clonedGreenV1 = clonedProjectToSphere(-clonedHalfSide, clonedNegativeCircleY, -clonedHalfSide)
        const clonedGreenV2 = clonedProjectToSphere(clonedHalfSide, clonedNegativeCircleY, -clonedHalfSide)
        const clonedGreenV3 = clonedProjectToSphere(clonedHalfSide, clonedNegativeCircleY, clonedHalfSide)
        const clonedGreenV4 = clonedProjectToSphere(-clonedHalfSide, clonedNegativeCircleY, clonedHalfSide)

        const clonedGreenArc1Points = createClonedGreatArc(clonedGreenV1, clonedGreenV2)
        const clonedGreenArc2Points = createClonedGreatArc(clonedGreenV2, clonedGreenV3)
        const clonedGreenArc3Points = createClonedGreatArc(clonedGreenV3, clonedGreenV4)
        const clonedGreenArc4Points = createClonedGreatArc(clonedGreenV4, clonedGreenV1)

        const clonedGreenSquareArc1 = createArcLine(clonedGreenArc1Points, 0x008000)
        const clonedGreenSquareArc2 = createArcLine(clonedGreenArc2Points, 0x008000)
        const clonedGreenSquareArc3 = createArcLine(clonedGreenArc3Points, 0x008000)
        const clonedGreenSquareArc4 = createArcLine(clonedGreenArc4Points, 0x008000)

        // Apply clipping planes to cloned green square arcs
        if (clonedGreenSquareArc1.material instanceof LineMaterial) {
          clonedGreenSquareArc1.material.clippingPlanes = [clonedClippingPlane]
        }
        if (clonedGreenSquareArc2.material instanceof LineMaterial) {
          clonedGreenSquareArc2.material.clippingPlanes = [clonedClippingPlane]
        }
        if (clonedGreenSquareArc3.material instanceof LineMaterial) {
          clonedGreenSquareArc3.material.clippingPlanes = [clonedClippingPlane]
        }
        if (clonedGreenSquareArc4.material instanceof LineMaterial) {
          clonedGreenSquareArc4.material.clippingPlanes = [clonedClippingPlane]
        }

        clonedWireframe.add(clonedGreenSquareArc1)
        clonedWireframe.add(clonedGreenSquareArc2)
        clonedWireframe.add(clonedGreenSquareArc3)
        clonedWireframe.add(clonedGreenSquareArc4)
      }


      // Create grey spheres at each vertex (will turn black when clicked)
      raycaster = new THREE.Raycaster()
      vertexGroup = new THREE.Group()
      vertexGroupRef.current = vertexGroup
      vertexSpheres = []
      
      for (let i = 0; i < data.vertices.length; i++) {
        const vertexPos = new THREE.Vector3(...data.vertices[i])
        // Create grey sphere at each vertex (stone sphere)
        const sphereGeometry = new THREE.SphereGeometry(0.06, 32, 32)
        const sphereMaterial = new THREE.MeshStandardMaterial({ 
          color: COLOR_EMPTY,
          metalness: METALNESS_DEFAULT,
          roughness: ROUGHNESS_INITIAL_SPHERE,
          transparent: true,
          opacity: OPACITY_EMPTY
        })
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
        sphere.position.copy(vertexPos)
        sphere.userData = { vertexIndex: i }
        vertexGroup.add(sphere)
        vertexSpheres.push(sphere)
        
        // Store sphere reference (initially grey, will turn black when clicked)
        stonesRef.current.set(i, sphere)
      }
      
      // Apply the same rotation as wireframe
      vertexGroup.quaternion.copy(initialQuaternion)
      scene.add(vertexGroup)

      // Create cloned vertex spheres at cloned scale
      if (clonedWireframe) {
        clonedVertexGroup = new THREE.Group()
        clonedVertexGroupRef.current = clonedVertexGroup
        
        // Get clipping plane (same as cloned wireframe)
        const clonedClippingPlane = new THREE.Plane(viewDirection.clone().negate(), 0)
        
        for (let i = 0; i < data.vertices.length; i++) {
          const vertexPos = new THREE.Vector3(...data.vertices[i]).multiplyScalar(cloneScale)
          // Create cloned sphere at scaled position
          const clonedSphereGeometry = new THREE.SphereGeometry(0.06 * cloneScale, 32, 32)
          const clonedSphereMaterial = new THREE.MeshStandardMaterial({ 
            color: COLOR_EMPTY,
            metalness: METALNESS_DEFAULT,
            roughness: ROUGHNESS_INITIAL_SPHERE,
            transparent: true,
            opacity: OPACITY_EMPTY,
            clippingPlanes: [clonedClippingPlane]
          })
          const clonedSphere = new THREE.Mesh(clonedSphereGeometry, clonedSphereMaterial)
          clonedSphere.position.copy(vertexPos)
          clonedSphere.userData = { vertexIndex: i }
          clonedVertexGroup.add(clonedSphere)
          
          // Store cloned sphere reference
          clonedStonesRef.current.set(i, clonedSphere)
        }
        
        // Apply the same rotation as wireframe
        clonedVertexGroup.quaternion.copy(initialQuaternion)
        scene.add(clonedVertexGroup)
      }

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(5, 5, 5)
      scene.add(directionalLight)

      // Add spotlight near the board
      const spotlight = new THREE.SpotLight(0xffffff, 15.0, 20, Math.PI / 6, 0.3, 2)
      spotlight.position.set(6, 5, 2) // Off-center position
      spotlight.target.position.set(0, 0, 0)
      scene.add(spotlight)
      scene.add(spotlight.target)

      // Handle window resize
      handleResize = () => {
        const width = window.innerWidth
        const height = window.innerHeight
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
        // Update line material resolution for proper rendering
        if (wireframe instanceof LineSegments2) {
          (wireframe.material as LineMaterial).resolution.set(width, height)
        }
        if (clonedWireframe instanceof LineSegments2) {
          (clonedWireframe.material as LineMaterial).resolution.set(width, height)
        }
        // Update square arc line materials resolution
        squareArcs.forEach(arc => {
          if (arc.material instanceof LineMaterial) {
            arc.material.resolution.set(width, height)
          }
        })
        // Update cloned square arc line materials resolution
        if (clonedWireframe) {
          clonedWireframe.traverse((child) => {
            if (child instanceof Line2 && child.material instanceof LineMaterial) {
              child.material.resolution.set(width, height)
            }
          })
        }
      }
      window.addEventListener('resize', handleResize)

      // Mouse drag handlers for rotation
      handleMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        // Only handle mouse down on canvas
        if (target.tagName !== 'CANVAS') return
        
        // Only start drag on left mouse button
        if (e.button !== 0) return
        
        isDraggingRef.current = true
        mouseDownPositionRef.current = { x: e.clientX, y: e.clientY }
        lastMousePositionRef.current = { x: e.clientX, y: e.clientY }
        
        // Change cursor to grabbing
        if (renderer) {
          renderer.domElement.style.cursor = 'grabbing'
        }
        
        // Prevent default to avoid text selection
        e.preventDefault()
      }
      
      handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current || !lastMousePositionRef.current) return
        
        const deltaX = e.clientX - lastMousePositionRef.current.x
        const deltaY = e.clientY - lastMousePositionRef.current.y
        
        // Rotation sensitivity (adjust as needed)
        const rotationSensitivity = 0.005
        
        // Update rotation: horizontal movement = yaw, vertical movement = pitch
        rotationRef.current.yaw += deltaX * rotationSensitivity
        rotationRef.current.pitch += deltaY * rotationSensitivity // Drag down = rotate down, drag up = rotate up
        
        // Clamp pitch to -90 to +90 degrees
        const maxPitch = Math.PI / 2
        const minPitch = -Math.PI / 2
        rotationRef.current.pitch = Math.max(minPitch, Math.min(maxPitch, rotationRef.current.pitch))
        
        lastMousePositionRef.current = { x: e.clientX, y: e.clientY }
      }
      
      handleMouseUp = (e: MouseEvent) => {
        if (!isDraggingRef.current) return
        
        // Check if this was a click (no significant movement) or a drag
        const wasClick = mouseDownPositionRef.current && 
          Math.abs(e.clientX - mouseDownPositionRef.current.x) < 5 &&
          Math.abs(e.clientY - mouseDownPositionRef.current.y) < 5
        
        isDraggingRef.current = false
        lastMousePositionRef.current = null
        mouseDownPositionRef.current = null
        
        // Change cursor back to grab
        if (renderer) {
          renderer.domElement.style.cursor = 'grab'
        }
        
        // If it was a click (not a drag), trigger the click handler
        if (wasClick) {
          handleClick(e)
        }
      }
      
      handleMouseLeave = (e: MouseEvent) => {
        // Reset drag state if mouse leaves the window while dragging
        if (isDraggingRef.current) {
          isDraggingRef.current = false
          lastMousePositionRef.current = null
          mouseDownPositionRef.current = null
          if (renderer) {
            renderer.domElement.style.cursor = 'grab'
          }
        }
      }
      
      renderer.domElement.addEventListener('mousedown', handleMouseDown)
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('mouseleave', handleMouseLeave)
      
      // Click handler for placing stones on vertex spheres
      handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        // Only handle clicks on canvas
        if (target.tagName !== 'CANVAS') return
        
        // Don't handle click if we're currently dragging
        if (isDraggingRef.current) return
        
        // Get mouse position in normalized device coordinates (-1 to +1)
        const rect = renderer.domElement.getBoundingClientRect()
        const mouse = new THREE.Vector2()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        
        // Update raycaster with camera and mouse position
        raycaster.setFromCamera(mouse, camera)
        
        // Check all intersections to see if midradiusSphere blocks vertex sphere clicks
        const objectsToCheck: THREE.Object3D[] = [vertexGroup]
        if (midradiusSphere) {
          objectsToCheck.push(midradiusSphere)
        }
        const intersects = raycaster.intersectObjects(objectsToCheck, true)
        
        if (intersects.length > 0) {
          // Check if the first intersection is the midradiusSphere
          const firstIntersection = intersects[0].object
          if (midradiusSphere && firstIntersection === midradiusSphere) {
            // MidradiusSphere blocks the click - don't trigger any event
            return
          }
          
          // Check if the first intersection is a vertex sphere
          if (firstIntersection.parent === vertexGroup) {
            const clickedSphere = firstIntersection as THREE.Mesh
            
            // Get vertex index
            const vertexIndex = clickedSphere.userData.vertexIndex
            const material = clickedSphere.material as THREE.MeshStandardMaterial
            
            // Check if game is over (use ref to get latest game state)
            const isGameOver = gameRef.current.isGameOver()
            const board = gameRef.current.getBoard()
            const state = board.get(vertexIndex) ?? null
            
            if (isGameOver) {
              // Game is over - allow removing groups by clicking on any vertex with an actual stone
              // Don't allow removing ownership states
              if (state === 'black' || state === 'white') {
                // Clicked on a stone - remove the group
                onRemoveGroupRef.current(vertexIndex)
              }
            } else {
              // Game is active - only allow placing stones on empty (null) vertices
              // Ownership states shouldn't exist during active play, but check anyway
              if (state === null) {
                // Check if player can make moves
                if (!canMakeMoveRef.current) {
                  return // Not player's turn
                }
                // Emit placeStone event - parent component will validate and update game state
                onPlaceStoneRef.current(vertexIndex)
              }
            }
          }
        }
      }

      // Animation loop
      // Coordinate system: X=right, Y=up, Z=out (towards viewer)
      const animate = () => {
        animationId = requestAnimationFrame(animate)
        
        // Clamp pitch to -90 to +90 degrees (-Math.PI/2 to Math.PI/2 radians)
        const maxPitch = Math.PI / 2  // 90 degrees
        const minPitch = -Math.PI / 2  // -90 degrees
        rotationRef.current.pitch = Math.max(minPitch, Math.min(maxPitch, rotationRef.current.pitch))

        // Apply rotations correctly:
        // 1. Start with initial rotation
        // 2. Rotate around global X axis (pitch) - this rotates Y to Y'
        // 3. Rotate around local Y' axis (yaw)
        
        // Get the global X axis direction (right vector in screen space)
        const globalXAxis = right.clone()
        
        // Create quaternion for rotation around global X axis (pitch)
        const pitchQuaternion = new THREE.Quaternion()
        pitchQuaternion.setFromAxisAngle(globalXAxis, rotationRef.current.pitch)
        
        // Start with initial rotation, then apply pitch around global X
        // Order: pitch * initial (pitch is applied in world space after initial rotation)
        const afterPitchQuaternion = new THREE.Quaternion()
        afterPitchQuaternion.multiplyQuaternions(pitchQuaternion, initialQuaternion)
        
        // Get the local Y' axis after pitch rotation
        const localYAxis = new THREE.Vector3(0, 1, 0)
        localYAxis.applyQuaternion(afterPitchQuaternion)
        
        // Create quaternion for yaw rotation around local Y' axis
        const yawQuaternion = new THREE.Quaternion()
        yawQuaternion.setFromAxisAngle(localYAxis, rotationRef.current.yaw)
        
        // Final rotation: yaw (around Y') * pitch (around global X) * initial
        // Multiply yaw on the left to rotate in world space around the transformed Y axis
        wireframe.quaternion.multiplyQuaternions(yawQuaternion, afterPitchQuaternion)
        
        // Update vertex group rotation to match wireframe
        if (vertexGroup) {
          vertexGroup.quaternion.copy(wireframe.quaternion)
        }
        
        // Update cloned wireframe rotation to match wireframe
        if (clonedWireframe) {
          clonedWireframe.quaternion.copy(wireframe.quaternion)
        }
        
        // Update cloned vertex group rotation to match wireframe
        if (clonedVertexGroup) {
          clonedVertexGroup.quaternion.copy(wireframe.quaternion)
        }
        
        renderer.render(scene, camera)
      }

      animate()
      
      // Initial sphere color update
      updateSphereColors()
      updateAura()
    }

    init()

    // Cleanup function
    return () => {
      document.removeEventListener('dragstart', preventDrag, true)
      document.removeEventListener('touchmove', preventTouchDrag, true)
      if (handleResize) window.removeEventListener('resize', handleResize)
      if (handleMouseDown && renderer) {
        renderer.domElement.removeEventListener('mousedown', handleMouseDown)
      }
      if (handleMouseMove) {
        window.removeEventListener('mousemove', handleMouseMove)
      }
      if (handleMouseUp) {
        window.removeEventListener('mouseup', handleMouseUp)
      }
      if (handleMouseLeave) {
        window.removeEventListener('mouseleave', handleMouseLeave)
      }
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
      // Cleanup: Remove ALL canvases from container
      // Try containerRef first, fallback to finding by class name if ref is null
      let container: HTMLElement | null = containerRef.current
      if (!container) {
        // Fallback: find container by class name (for cleanup when ref is null)
        container = document.querySelector('.fullscreen-canvas') as HTMLElement
      }
      
      if (container) {
        const canvases = container.querySelectorAll('canvas')
        canvases.forEach(canvas => {
          container!.removeChild(canvas)
        })
      }
      // Dispose renderer if it exists
      if (renderer) {
        renderer.dispose()
      }
    }
      }, [dataFile, game]) // Removed onPlaceStone and onStateChange from dependencies - using refs instead
  
  // Update sphere colors and aura when game state changes
  useEffect(() => {
    if (gameRef.current && stonesRef.current.size > 0) {
      updateSphereColors()
      updateAura()
    }
  }, [game, onStateChange, updateTrigger])

  const isGameOver = game.isGameOver()
  
  // Check if there are any empty vertices (null) - if not, ownership has been marked
  const board = game.getBoard()
  const hasEmptyVertices = Array.from(board.values()).some(state => state === null)

  return (
    <div className="fullscreen-viewer">
      <div ref={containerRef} className="fullscreen-canvas" style={{ position: 'relative' }}>
        {isGameOver && hasEmptyVertices && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontSize: '32px',
            fontWeight: 'bold',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
            pointerEvents: 'none',
            zIndex: 10,
            textAlign: 'center'
          }}>
            Remove Dead Groups
          </div>
        )}
      </div>
    </div>
  )
}

