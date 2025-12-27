'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { parsePolyhedronData, createWireframeGeometry } from '@/lib/polyhedronUtils'
import { GoGame, StoneColor } from '@/lib/goGame'

interface GoPolyhedronViewerProps {
  dataFile: string
  name: string
  /** Game instance to use for move validation and state */
  game: GoGame
  /** Callback when a stone placement is attempted (vertexIndex) */
  onPlaceStone: (vertexIndex: number) => void
  /** Callback to trigger re-render when board state changes */
  onStateChange: () => void
  /** Update trigger to force re-render when game state changes */
  updateTrigger?: number
}

export default function GoPolyhedronViewer({ dataFile, name, game, onPlaceStone, onStateChange, updateTrigger }: GoPolyhedronViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const rotationRef = useRef({ pitch: 0, yaw: 0 })
  const keysRef = useRef<Set<string>>(new Set())
  const stonesRef = useRef<Map<number, THREE.Mesh>>(new Map())
  // Store callbacks in refs to prevent re-renders when they change
  const onPlaceStoneRef = useRef(onPlaceStone)
  const onStateChangeRef = useRef(onStateChange)
  
  // Update refs when callbacks change
  useEffect(() => {
    onPlaceStoneRef.current = onPlaceStone
    onStateChangeRef.current = onStateChange
  }, [onPlaceStone, onStateChange])
  
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
        // Empty vertex - grey
        material.color.setHex(0x808080)
      } else if (color === 'black') {
        // Black stone
        material.color.setHex(0x000000)
      } else if (color === 'white') {
        // White stone
        material.color.setHex(0xffffff)
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
        
        const midradiusSphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
        // Add to wireframe so it rotates with local axes
        wireframe.add(midradiusSphere)
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

      // Add global axes to the scene for reference (semi-transparent RGB)
      // Rotated so X and Y lie in the screen plane, Z points out (towards camera)
      const globalAxesGroup = new THREE.Group()
      
      // Create axes in their default orientation
      const globalXGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(2.5, 0, 0)
      ])
      const globalXMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2, opacity: 0.4, transparent: true }) // Red
      const globalXAxis = new THREE.Line(globalXGeometry, globalXMaterial)
      globalAxesGroup.add(globalXAxis)

      const globalYGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 2.5, 0)
      ])
      const globalYMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2, opacity: 0.4, transparent: true }) // Green
      const globalYAxis = new THREE.Line(globalYGeometry, globalYMaterial)
      globalAxesGroup.add(globalYAxis)

      const globalZGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 2.5)
      ])
      const globalZMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 2, opacity: 0.4, transparent: true }) // Blue
      const globalZAxis = new THREE.Line(globalZGeometry, globalZMaterial)
      globalAxesGroup.add(globalZAxis)

      // Apply the same rotation matrix to global axes
      // This ensures global and local axes initially overlap
      globalAxesGroup.applyMatrix4(initialRotationMatrix)

      scene.add(globalAxesGroup)

      // Create grey spheres at each vertex (will turn black when clicked)
      raycaster = new THREE.Raycaster()
      vertexGroup = new THREE.Group()
      vertexSpheres = []
      
      for (let i = 0; i < data.vertices.length; i++) {
        const vertexPos = new THREE.Vector3(...data.vertices[i])
        // Create grey sphere at each vertex
        const sphereGeometry = new THREE.SphereGeometry(0.06, 32, 32)
        const sphereMaterial = new THREE.MeshStandardMaterial({ 
          color: 0x808080, // 50% grey
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

      // Click handler for turning spheres black
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
        
        // Find intersections with the visible spheres (recursive to include all spheres in group)
        const intersects = raycaster.intersectObjects([vertexGroup], true)
        
        if (intersects.length > 0) {
          // Get the clicked sphere mesh
          const clickedSphere = intersects[0].object as THREE.Mesh
          
          // Get the world position of the clicked sphere
          const worldPosition = new THREE.Vector3()
          clickedSphere.getWorldPosition(worldPosition)
          
          // Transform world position back to original global coordinate system
          // The initialRotationMatrix rotates the global axes, so we need to invert it
          // to check the Z coordinate in the original (unrotated) global space
          const inverseRotationMatrix = new THREE.Matrix4()
          inverseRotationMatrix.copy(initialRotationMatrix).invert()
          const globalPosition = worldPosition.clone().applyMatrix4(inverseRotationMatrix)
          
          // Check if sphere is behind the XY global plane (Z < 0 in original global coordinates)
          // The XY plane divides space: Z > 0 is in front, Z < 0 is behind
          if (globalPosition.z < 0) {
            // Sphere is behind the XY global plane, don't allow clicking
            console.log('Sphere behind XY plane, click ignored')
            return
          }
          
          // Get vertex index and check if it's empty (grey)
          const vertexIndex = clickedSphere.userData.vertexIndex
          const material = clickedSphere.material as THREE.MeshStandardMaterial
          
          // Only allow placing stones on empty (grey) vertices
          if (material.color.getHex() === 0x808080) {
            // Emit placeStone event - parent component will validate and update game state
            onPlaceStoneRef.current(vertexIndex)
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
  
  // Update sphere colors when game state changes
  useEffect(() => {
    if (game && stonesRef.current.size > 0) {
      updateSphereColors()
    }
  }, [game, onStateChange, updateTrigger])

  return (
    <div className="fullscreen-viewer">
      <div className="viewer-header">
        <h2>{name} - Play Go</h2>
        <button onClick={() => router.push('/')} className="back-button">
          ← Back
        </button>
      </div>
      <div className="controls-hint">
        Click on front-facing grey vertices to place stones • Use WASD to rotate • ESC to go back
      </div>
      <div ref={containerRef} className="fullscreen-canvas" />
    </div>
  )
}

