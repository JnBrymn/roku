'use client'

import { useEffect } from 'react'
import PolyhedronViewer from '@/components/PolyhedronViewer'
import { polyhedraData } from '@/lib/polyhedronUtils'

export default function Home() {
  useEffect(() => {
    // Disable mouse interactions for rotation/dragging, but allow clicks for navigation
    const preventDrag = (e: Event) => {
      const target = e.target as HTMLElement
      // Allow clicks on polyhedron cards for navigation
      if (target.closest('.polyhedron-card')) {
        return
      }
      // Prevent other mouse interactions
      if (e.type === 'mousedown' || e.type === 'mousemove' || e.type === 'dragstart') {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const events = [
      'mousedown',
      'mousemove',
      'dragstart',
      'selectstart',
      'touchstart',
      'touchmove',
      'touchend'
    ]

    events.forEach(event => {
      document.addEventListener(event, preventDrag, true)
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, preventDrag, true)
      })
    }
  }, [])

  return (
    <>
      <header>
        <h1>Platonic Solids</h1>
        <p className="subtitle">Geometric Forms in Three Dimensions</p>
      </header>
      
      <div className="container">
        <div className="polyhedra-grid">
          {polyhedraData.map((polyhedron) => (
            <PolyhedronViewer
              key={polyhedron.name}
              dataFile={polyhedron.file}
              name={polyhedron.name}
            />
          ))}
        </div>
      </div>
    </>
  )
}
