'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { parsePolyhedronData, createWireframeGeometry } from '@/lib/polyhedronUtils'

interface GoPolyhedronViewerProps {
  dataFile: string
  name: string
}

export default function GoPolyhedronViewer({ dataFile, name }: GoPolyhedronViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const rotationRef = useRef({ pitch: 0, yaw: 0 })
  const keysRef = useRef<Set<string>>(new Set())
  const stonesRef = useRef<Map<number, THREE.Mesh>>(new Map())

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

      // Create renderer
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

      // Create invisible spheres at each vertex for raycasting
      raycaster = new THREE.Raycaster()
      vertexGroup = new THREE.Group()
      vertexSpheres = []
      
      for (let i = 0; i < data.vertices.length; i++) {
        const vertexPos = new THREE.Vector3(...data.vertices[i])
        // Create a larger invisible sphere for raycasting (easier to click)
        const sphereGeometry = new THREE.SphereGeometry(0.3, 16, 16)
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
          visible: false, 
          transparent: true, 
          opacity: 0 
        })
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
        sphere.position.copy(vertexPos)
        sphere.userData = { vertexIndex: i }
        vertexGroup.add(sphere)
        vertexSpheres.push(sphere)
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

      // Click handler for placing stones
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
        
        // Find intersections with vertex group (recursive to include all spheres)
        const intersects = raycaster.intersectObjects([vertexGroup], true)
        
        console.log('Click detected, intersections:', intersects.length)
        
        if (intersects.length > 0) {
          const hitSphere = intersects[0].object as THREE.Mesh
          const vertexIndex = hitSphere.userData.vertexIndex as number
          
          console.log('Hit vertex:', vertexIndex, 'Distance:', intersects[0].distance)
          
          // Get world position of the hit sphere (already transformed by parent group)
          const vertexWorldPos = new THREE.Vector3()
          hitSphere.getWorldPosition(vertexWorldPos)
          
          // Get camera forward direction
          const cameraDirection = new THREE.Vector3()
          camera.getWorldDirection(cameraDirection)
          
          // Vector from camera to vertex
          const cameraToVertex = new THREE.Vector3()
          cameraToVertex.subVectors(vertexWorldPos, camera.position)
          
          // Normalize for accurate dot product
          cameraToVertex.normalize()
          
          // Check if vertex is in front of camera (dot product > 0 means front-facing)
          // Also check that the intersection distance is reasonable (not too far)
          const dotProduct = cameraToVertex.dot(cameraDirection)
          const distance = intersects[0].distance
          
          console.log('Dot product:', dotProduct, 'Distance:', distance)
          
          if (dotProduct > 0 && distance < 100) {
            // Vertex is front-facing, place a stone
            // Check if stone already exists at this vertex
            if (!stonesRef.current.has(vertexIndex)) {
              console.log('Placing stone at vertex:', vertexIndex)
              
              // Create black stone (sphere)
              const stoneGeometry = new THREE.SphereGeometry(0.12, 32, 32)
              const stoneMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x000000,
                metalness: 0.3,
                roughness: 0.7
              })
              const stone = new THREE.Mesh(stoneGeometry, stoneMaterial)
              
              // Position stone at vertex (in wireframe's local space)
              stone.position.copy(new THREE.Vector3(...polyhedronData.vertices[vertexIndex]))
              
              // Add to wireframe so it rotates with the polyhedron
              wireframe.add(stone)
              
              // Store stone reference
              stonesRef.current.set(vertexIndex, stone)
            } else {
              console.log('Stone already exists at vertex:', vertexIndex)
            }
          } else {
            console.log('Vertex not front-facing or too far')
          }
        } else {
          console.log('No intersections found')
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
        
        // Update vertex spheres rotation to match wireframe
        if (vertexSpheres.length > 0 && vertexSpheres[0].parent) {
          vertexSpheres[0].parent.quaternion.copy(wireframe.quaternion)
        }
        
        renderer.render(scene, camera)
      }

      animate()
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
      if (renderer && containerRef.current && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement)
        renderer.dispose()
      }
    }
  }, [dataFile, router])

  return (
    <div className="fullscreen-viewer">
      <div className="viewer-header">
        <h2>{name} - Play Go</h2>
        <button onClick={() => router.push('/')} className="back-button">
          ← Back
        </button>
      </div>
      <div className="controls-hint">
        Click on front-facing vertices to place black stones • Use WASD to rotate • ESC to go back
      </div>
      <div ref={containerRef} className="fullscreen-canvas" />
    </div>
  )
}

