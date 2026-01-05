'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'
import { parsePolyhedronData, createWireframeGeometry, polyhedraData } from '@/lib/polyhedronUtils'

interface PolyhedronViewerProps {
  dataFile: string
  name: string
}

export default function PolyhedronViewer({ dataFile, name }: PolyhedronViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const animationIdRef = useRef<number | null>(null)
  const wireframeRef = useRef<THREE.LineSegments | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const router = useRouter()
  const [info, setInfo] = useState<string>('')
  
  // Find the slug for this polyhedron
  const polyhedron = polyhedraData.find(p => p.name === name)
  const slug = polyhedron?.slug || name.toLowerCase()

  useEffect(() => {
    if (!containerRef.current) return

    const init = async () => {
      // Check if component was unmounted before async completes (React Strict Mode)
      if (!containerRef.current) return
      
      // Fetch and parse data
      const response = await fetch(dataFile)
      const text = await response.text()
      const data = parsePolyhedronData(text)
      
      // Check again after async fetch (component might have unmounted)
      if (!containerRef.current) return
      
      setInfo(`${data.vertices.length} vertices, ${data.edges.length} edges`)

      // Create scene
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0f0f0f)
      sceneRef.current = scene

      // Create camera
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      camera.position.set(3, 3, 3)
      camera.lookAt(0, 0, 0)
      cameraRef.current = camera

      // Create renderer and store in ref IMMEDIATELY (before any DOM operations)
      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(400, 400)
      rendererRef.current = renderer
      
      // Final check before appending to DOM
      if (!containerRef.current) {
        renderer.dispose()
        rendererRef.current = null
        sceneRef.current = null
        cameraRef.current = null
        return
      }
      
      // Clear any existing canvases (React Strict Mode creates duplicates)
      const existingCanvases = containerRef.current.querySelectorAll('canvas')
      existingCanvases.forEach(canvas => {
        try {
          containerRef.current?.removeChild(canvas)
        } catch (e) {
          // Canvas may have already been removed
        }
      })
      
      containerRef.current.appendChild(renderer.domElement)

      // Create wireframe
      const geometry = createWireframeGeometry(data.vertices, data.edges)
      const material = new THREE.LineBasicMaterial({ 
        color: 0x667eea,
        linewidth: 2
      })
      const wireframe = new THREE.LineSegments(geometry, material)
      wireframeRef.current = wireframe
      scene.add(wireframe)

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(5, 5, 5)
      scene.add(directionalLight)

      // Animation loop
      const animate = () => {
        if (!rendererRef.current || !wireframeRef.current || !sceneRef.current || !cameraRef.current) {
          return // Guard against cleanup
        }
        animationIdRef.current = requestAnimationFrame(animate)
        
        wireframeRef.current.rotation.x += 0.005
        wireframeRef.current.rotation.y += 0.01
        wireframeRef.current.updateMatrixWorld(true)
        
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }

      animate()
    }

    init()

    // Cleanup
    return () => {
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current)
        animationIdRef.current = null
      }
      // Always dispose renderer if it exists, even if container is gone
      if (rendererRef.current) {
        // Try to remove canvas from DOM if container still exists
        if (containerRef.current) {
          try {
            containerRef.current.removeChild(rendererRef.current.domElement)
          } catch (e) {
            // Element may have already been removed - that's okay
          }
        }
        // Always dispose the renderer to free WebGL context
        rendererRef.current.dispose()
        rendererRef.current = null
      }
      // Clear refs
      wireframeRef.current = null
      sceneRef.current = null
      cameraRef.current = null
    }
  }, [dataFile])

  const handleClick = () => {
    router.push(`/polyhedron/${slug}/go`)
  }

  return (
    <div className="polyhedron-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
      <div className="polyhedron-name">{name}</div>
      <div className="canvas-container" ref={containerRef} />
      <div className="info">{info}</div>
    </div>
  )
}
