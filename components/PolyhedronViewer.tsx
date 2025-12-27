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
  const router = useRouter()
  const [info, setInfo] = useState<string>('')
  
  // Find the slug for this polyhedron
  const polyhedron = polyhedraData.find(p => p.name === name)
  const slug = polyhedron?.slug || name.toLowerCase()

  useEffect(() => {
    if (!containerRef.current) return

    let scene: THREE.Scene
    let camera: THREE.PerspectiveCamera
    let renderer: THREE.WebGLRenderer
    let wireframe: THREE.LineSegments
    let animationId: number

    const init = async () => {
      // Fetch and parse data
      const response = await fetch(dataFile)
      const text = await response.text()
      const data = parsePolyhedronData(text)
      
      setInfo(`${data.vertices.length} vertices, ${data.edges.length} edges`)

      // Create scene
      scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0f0f0f)

      // Create camera
      camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      camera.position.set(3, 3, 3)
      camera.lookAt(0, 0, 0)

      // Create renderer
      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(400, 400)
      containerRef.current?.appendChild(renderer.domElement)

      // Create wireframe
      const geometry = createWireframeGeometry(data.vertices, data.edges)
      const material = new THREE.LineBasicMaterial({ 
        color: 0x667eea,
        linewidth: 2
      })
      wireframe = new THREE.LineSegments(geometry, material)
      scene.add(wireframe)

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(5, 5, 5)
      scene.add(directionalLight)

      // Animation loop
      const animate = () => {
        animationId = requestAnimationFrame(animate)
        
        wireframe.rotation.x += 0.005
        wireframe.rotation.y += 0.01
        
        renderer.render(scene, camera)
      }

      animate()
    }

    init()

    // Cleanup
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
      if (renderer && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
        renderer.dispose()
      }
    }
  }, [dataFile])

  const handleClick = () => {
    router.push(`/polyhedron/${slug}`)
  }

  const handlePlayGo = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    router.push(`/polyhedron/${slug}/go`)
  }

  return (
    <div className="polyhedron-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
      <div className="polyhedron-name">{name}</div>
      <div className="canvas-container" ref={containerRef} />
      <div className="info">{info}</div>
      <button 
        onClick={handlePlayGo} 
        className="play-go-button"
        style={{ marginTop: '0.5rem' }}
      >
        Play Go
      </button>
    </div>
  )
}
