'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { parsePolyhedronData, createWireframeGeometry } from '@/lib/polyhedronUtils'
import { GoGame, StoneColor } from '@/lib/goGame'

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
}

export default function GoPolyhedronViewer({ dataFile, name, game, onPlaceStone, onRemoveGroup, onStateChange, updateTrigger }: GoPolyhedronViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const rotationRef = useRef({ pitch: 0, yaw: 0 })
  const keysRef = useRef<Set<string>>(new Set())
  const stonesRef = useRef<Map<number, THREE.Mesh>>(new Map())
  const auraRef = useRef<THREE.Mesh | null>(null)
  const vertexGroupRef = useRef<THREE.Group | null>(null)
  // Store callbacks in refs to prevent re-renders when they change
  const onPlaceStoneRef = useRef(onPlaceStone)
  const onRemoveGroupRef = useRef(onRemoveGroup)
  const onStateChangeRef = useRef(onStateChange)
  
  // Update refs when callbacks change
  useEffect(() => {
    onPlaceStoneRef.current = onPlaceStone
    onRemoveGroupRef.current = onRemoveGroup
    onStateChangeRef.current = onStateChange
  }, [onPlaceStone, onRemoveGroup, onStateChange])
  
  /**
   * Updates sphere colors based on current game board state.
   * Called when game state changes.
   */
  const updateSphereColors = () => {
    const board = game.getBoard()
    const entries = Array.from(stonesRef.current.entries())
    for (const [vertexIndex, sphere] of entries) {
      const color = board.get(vertexIndex)
      const material = sphere.material as THREE.MeshStandardMaterial
      
      if (color === null) {
        // Empty vertex - grey (lighter)
        material.color.setHex(0xAAAAAA)
        // Reset emissive properties that were set for white stones
        material.emissive.setHex(0x000000)
        material.emissiveIntensity = 0
        material.metalness = 0.3
        material.roughness = 0.7
      } else if (color === 'black') {
        // Black stone
        material.color.setHex(0x000000)
        // Reset emissive properties
        material.emissive.setHex(0x000000)
        material.emissiveIntensity = 0
        material.metalness = 0.3
        material.roughness = 0.7
      } else if (color === 'white') {
        // White stone - extremely white with maximum emissive glow
        material.color.setHex(0xffffff)
        material.emissive.setHex(0xffffff)
        material.emissiveIntensity = 1.5
        material.metalness = 0.0
        material.roughness = 0.1
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
    
    // Add aura to the last played stone (only if it still exists and has a stone)
    const lastPlayedIndex = game.getLastPlayedVertex()
    if (lastPlayedIndex !== null && vertexGroupRef.current) {
      const stone = stonesRef.current.get(lastPlayedIndex)
      const board = game.getBoard()
      const color = board.get(lastPlayedIndex)
      
      // Only add aura if the stone still exists (not removed/captured)
      if (stone && color !== null) {
        // Create a slightly larger sphere for the aura
        const auraGeometry = new THREE.SphereGeometry(0.08, 32, 32)
        const auraMaterial = new THREE.MeshStandardMaterial({
          color: 0xffff00, // Yellow
          emissive: 0xffff00,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide
        })
        const aura = new THREE.Mesh(auraGeometry, auraMaterial)
        
        // Position aura at the same location as the stone (relative to stone's parent)
        aura.position.copy(stone.position)
        
        // Add aura to the vertex group
        vertexGroupRef.current.add(aura)
        auraRef.current = aura
      }
    }
  }

  useEffect(() => {
    if (!containerRef.current) return

    // Allow clicks on canvas for placing stones, but prevent dragging
    const preventDrag = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Allow clicks on the back button
      if (target.closest('.back-button')) {
        return
      }
      // Allow clicks on canvas (for placing stones)
      if (target.tagName === 'CANVAS') {
        return
      }
      // Prevent other mouse interactions
      if (e.type === 'mousemove' || e.type === 'dragstart') {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const preventTouchDrag = (e: TouchEvent) => {
      // Allow touch clicks but prevent dragging
      if (e.type === 'touchmove') {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('mousemove', preventDrag, true)
    document.addEventListener('dragstart', preventDrag, true)
    document.addEventListener('touchmove', preventTouchDrag, true)

    let scene: THREE.Scene
    let camera: THREE.PerspectiveCamera
    let renderer: THREE.WebGLRenderer
    let wireframe: LineSegments2 | THREE.LineSegments
    let animationId: number
    let handleResize: () => void
    let handleKeyDown: (e: KeyboardEvent) => void
    let handleKeyUp: (e: KeyboardEvent) => void
    let handleClick: (e: MouseEvent) => void
    let raycaster: THREE.Raycaster
    let vertexSpheres: THREE.Mesh[] = []
    let vertexGroup: THREE.Group
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
      scene.background = new THREE.Color(0x808080)

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

      // Add midradius sphere at origin if midradius is defined
      // Colored based on local radius direction (RGB mapping)
      // Attached to wireframe so it rotates with local axes
      if (data.midradius !== undefined) {
        const sphereGeometry = new THREE.SphereGeometry(data.midradius, 64, 64)
        
        // Custom shader material that colors based on direction vector (local radius direction)
        // RGB = direction vector components, negative values are inverted
        const sphereMaterial = new THREE.ShaderMaterial({
          vertexShader: `
            varying vec3 vDirection;
            void main() {
              // Use local position (relative to wireframe) for direction
              vDirection = normalize(position);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vDirection;
            void main() {
              // Get direction vector (local radius direction from origin)
              vec3 dir = normalize(vDirection);
              
              // Map direction components to RGB: R=X, G=Y, B=Z
              // Normalize from [-1, 1] to [0, 1]
              vec3 rgb = dir * 0.5 + 0.5;
              
              // If component is negative, invert that color channel
              vec3 inverted = 1.0 - rgb;
              float r = dir.x < 0.0 ? inverted.x : rgb.x;
              float g = dir.y < 0.0 ? inverted.y : rgb.y;
              float b = dir.z < 0.0 ? inverted.z : rgb.z;
              
              gl_FragColor = vec4(r, g, b, 1.0);
            }
          `
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
          color: 0x0000ff, // Blue
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
          color: 0x00ff00, // Green
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
          color: 0xff0000, // Red
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
        
        const squareArc1 = createArcLine(arc1Points, 0xff0000) // Red
        const squareArc2 = createArcLine(arc2Points, 0xff0000) // Red
        const squareArc3 = createArcLine(arc3Points, 0xff0000) // Red
        const squareArc4 = createArcLine(arc4Points, 0xff0000) // Red
        
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
        
        const blueSquareArc1 = createArcLine(blueArc1Points, 0x0000ff) // Blue
        const blueSquareArc2 = createArcLine(blueArc2Points, 0x0000ff) // Blue
        const blueSquareArc3 = createArcLine(blueArc3Points, 0x0000ff) // Blue
        const blueSquareArc4 = createArcLine(blueArc4Points, 0x0000ff) // Blue
        
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
        
        const greenSquareArc1 = createArcLine(greenArc1Points, 0x00ff00) // Green
        const greenSquareArc2 = createArcLine(greenArc2Points, 0x00ff00) // Green
        const greenSquareArc3 = createArcLine(greenArc3Points, 0x00ff00) // Green
        const greenSquareArc4 = createArcLine(greenArc4Points, 0x00ff00) // Green
        
        squareArcs.push(greenSquareArc1, greenSquareArc2, greenSquareArc3, greenSquareArc4)
        
        wireframe.add(greenSquareArc1)
        wireframe.add(greenSquareArc2)
        wireframe.add(greenSquareArc3)
        wireframe.add(greenSquareArc4)
      }

      // Add local axes attached to wireframe - shows Y' as it rotates
      // Colors: RGB (Red=X, Green=Y, Blue=Z)
      // X axis (Red) - right
      const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(2, 0, 0)
      ])
      const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 }) // Pure Red
      const xAxis = new THREE.Line(xAxisGeometry, xAxisMaterial)
      wireframe.add(xAxis)

      // Y axis (Green) - up (becomes Y' after rotation)
      const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 2, 0)
      ])
      const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 }) // Pure Green
      const yAxis = new THREE.Line(yAxisGeometry, yAxisMaterial)
      wireframe.add(yAxis)

      // Z axis (Blue) - out (towards viewer)
      const zAxisGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 2)
      ])
      const zAxisMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 }) // Pure Blue
      const zAxis = new THREE.Line(zAxisGeometry, zAxisMaterial)
      wireframe.add(zAxis)

      // Create grey spheres at each vertex (will turn black when clicked)
      raycaster = new THREE.Raycaster()
      vertexGroup = new THREE.Group()
      vertexGroupRef.current = vertexGroup
      vertexSpheres = []
      
      for (let i = 0; i < data.vertices.length; i++) {
        const vertexPos = new THREE.Vector3(...data.vertices[i])
        // Create grey sphere at each vertex
        const sphereGeometry = new THREE.SphereGeometry(0.06, 32, 32)
        const sphereMaterial = new THREE.MeshStandardMaterial({ 
          color: 0xAAAAAA, // Lighter grey
          metalness: 0.3,
          roughness: 0.7
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

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(5, 5, 5)
      scene.add(directionalLight)

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
        // Update square arc line materials resolution
        squareArcs.forEach(arc => {
          if (arc.material instanceof LineMaterial) {
            arc.material.resolution.set(width, height)
          }
        })
      }
      window.addEventListener('resize', handleResize)

      // Keyboard controls
      handleKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase()
        keysRef.current.add(key)
        
        // Handle ESC to go back
        if (key === 'escape') {
          router.push('/')
        }
      }

      handleKeyUp = (e: KeyboardEvent) => {
        keysRef.current.delete(e.key.toLowerCase())
      }

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)

      // Click handler for placing stones on vertex spheres
      handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        // Only handle clicks on canvas
        if (target.tagName !== 'CANVAS') return
        
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
            
            // Check if game is over
            const isGameOver = game.isGameOver()
            
            if (isGameOver) {
              // Game is over - allow removing groups by clicking on any vertex with a stone
              if (material.color.getHex() !== 0xAAAAAA) {
                // Clicked on a stone - remove the group
                onRemoveGroupRef.current(vertexIndex)
              }
            } else {
              // Game is active - only allow placing stones on empty (grey) vertices
              if (material.color.getHex() === 0xAAAAAA) {
                // Emit placeStone event - parent component will validate and update game state
                onPlaceStoneRef.current(vertexIndex)
              }
            }
          }
        }
      }
      
      renderer.domElement.addEventListener('click', handleClick)

      // Animation loop with WASD controls
      // Coordinate system: X=right, Y=up, Z=out (towards viewer)
      const animate = () => {
        animationId = requestAnimationFrame(animate)
        
        const rotationSpeed = 0.02
        
        // W/S: Rotate Y' around global X axis (pitch)
        // S: Y' rotates clockwise around X (positive rotation around X)
        // W: Y' rotates counterclockwise around X (negative rotation around X)
        if (keysRef.current.has('s')) {
          rotationRef.current.pitch += rotationSpeed  // Clockwise around X
        }
        if (keysRef.current.has('w')) {
          rotationRef.current.pitch -= rotationSpeed  // Counterclockwise around X
        }
        
        // Clamp pitch to -90 to +90 degrees (-Math.PI/2 to Math.PI/2 radians)
        const maxPitch = Math.PI / 2  // 90 degrees
        const minPitch = -Math.PI / 2  // -90 degrees
        rotationRef.current.pitch = Math.max(minPitch, Math.min(maxPitch, rotationRef.current.pitch))
        
        // A/D: Rotate around Y' axis (yaw) - local Y axis after X rotation
        // D: Rotate positive around Y'
        // A: Rotate negative around Y'
        if (keysRef.current.has('d')) {
          rotationRef.current.yaw += rotationSpeed
        }
        if (keysRef.current.has('a')) {
          rotationRef.current.yaw -= rotationSpeed
        }

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
      document.removeEventListener('mousemove', preventDrag, true)
      document.removeEventListener('dragstart', preventDrag, true)
      document.removeEventListener('touchmove', preventTouchDrag, true)
      if (handleResize) window.removeEventListener('resize', handleResize)
      if (handleKeyDown) window.removeEventListener('keydown', handleKeyDown)
      if (handleKeyUp) window.removeEventListener('keyup', handleKeyUp)
      if (handleClick && renderer) {
        renderer.domElement.removeEventListener('click', handleClick)
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
  }, [dataFile, router, game]) // Removed onPlaceStone and onStateChange from dependencies - using refs instead
  
  // Update sphere colors and aura when game state changes
  useEffect(() => {
    if (game && stonesRef.current.size > 0) {
      updateSphereColors()
      updateAura()
    }
  }, [game, onStateChange, updateTrigger])

  const isGameOver = game.isGameOver()

  return (
    <div className="fullscreen-viewer">
      <div className="viewer-header">
        <h2>{name} - Play Go</h2>
        <button onClick={() => router.push('/')} className="back-button">
          ← Back
        </button>
      </div>
      <div className="controls-hint">
        {isGameOver 
          ? 'Click on any stone to remove dead groups • Use WASD to rotate • ESC to go back'
          : 'Click on front-facing grey vertices to place stones • Use WASD to rotate • ESC to go back'}
      </div>
      <div ref={containerRef} className="fullscreen-canvas" style={{ position: 'relative' }}>
        {isGameOver && (
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

