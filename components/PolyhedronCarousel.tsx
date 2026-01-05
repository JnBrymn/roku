'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import PolyhedronViewer from '@/components/PolyhedronViewer'
import { polyhedraData } from '@/lib/polyhedronUtils'
import { parsePolyhedronData } from '@/lib/polyhedronUtils'

interface PolyhedronWithVertexCount {
  file: string
  name: string
  slug: string
  vertexCount: number
}

export default function PolyhedronCarousel() {
  const [sortedPolyhedra, setSortedPolyhedra] = useState<PolyhedronWithVertexCount[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [mountedIndices, setMountedIndices] = useState<Set<number>>(new Set())
  const [transitioningOutIndex, setTransitioningOutIndex] = useState<number | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  // Load and sort polyhedra by vertex count
  useEffect(() => {
    const loadAndSortPolyhedra = async () => {
      try {
        const polyhedraWithCounts = await Promise.all(
          polyhedraData.map(async (polyhedron) => {
            try {
              const response = await fetch(polyhedron.file)
              const text = await response.text()
              const data = parsePolyhedronData(text)
              return {
                ...polyhedron,
                vertexCount: data.vertices.length
              }
            } catch (error) {
              console.error(`Error loading ${polyhedron.name}:`, error)
              return {
                ...polyhedron,
                vertexCount: 0
              }
            }
          })
        )

        // Sort by vertex count
        const sorted = polyhedraWithCounts.sort((a, b) => a.vertexCount - b.vertexCount)
        setSortedPolyhedra(sorted)
        setLoading(false)
      } catch (error) {
        console.error('Error loading polyhedra:', error)
        setLoading(false)
      }
    }

    loadAndSortPolyhedra()
  }, [])

  // Calculate visible indices (show 3 at a time, plus one on each side for smooth transitions)
  const visibleIndices = useMemo(() => {
    if (sortedPolyhedra.length === 0) return []
    
    const indices: number[] = []
    const total = sortedPolyhedra.length
    
    // Show 5 items: 2 left, center, 2 right (but only 3 visible)
    for (let i = -2; i <= 2; i++) {
      let idx = currentIndex + i
      if (idx < 0) {
        idx = total + idx
      } else if (idx >= total) {
        idx = idx - total
      }
      indices.push(idx)
    }
    
    return indices
  }, [currentIndex, sortedPolyhedra.length])
  
  // Update mounted indices - keep canvases mounted for visible items and items transitioning
  useEffect(() => {
    if (sortedPolyhedra.length === 0) return
    
    const newMountedIndices = new Set<number>()
    visibleIndices.forEach((idx, displayIndex) => {
      const relativePosition = displayIndex - 2
      // Mount for positions -1, 0, 1, 2 (not -2 which is fully off-screen)
      if (relativePosition >= -1 && relativePosition <= 2) {
        newMountedIndices.add(idx)
      }
    })
    
    // If there's an item transitioning out, keep it mounted during transition
    if (transitioningOutIndex !== null && isTransitioning) {
      newMountedIndices.add(transitioningOutIndex)
    }
    
    // Update mounted indices - this should never exceed 5 (4 normal + 1 transitioning out)
    setMountedIndices(newMountedIndices)
  }, [visibleIndices, sortedPolyhedra.length, isTransitioning, transitioningOutIndex])
  
  const handleNavigation = useCallback((direction: 'left' | 'right') => {
    if (isTransitioning) return
    
    setIsTransitioning(true)
    
    // When clicking right, the item at position -1 moves to -2 (off-screen)
    // We need to keep its canvas mounted during transition, then clean it up
    // When clicking left, nothing moves to position -2, so no special tracking needed
    if (direction === 'right') {
      const itemMovingToMinus2 = visibleIndices[1] // Position -1 is at displayIndex 1
      setTransitioningOutIndex(itemMovingToMinus2)
    } else {
      setTransitioningOutIndex(null) // No item transitioning out when going left
    }
    
    setCurrentIndex((prev) => {
      if (direction === 'left') {
        return prev === 0 ? sortedPolyhedra.length - 1 : prev - 1
      } else {
        return prev === sortedPolyhedra.length - 1 ? 0 : prev + 1
      }
    })
    
    // After transition completes, clean up the transitioning item
    setTimeout(() => {
      setIsTransitioning(false)
      setTransitioningOutIndex(null)
      // Cleanup will happen automatically in the useEffect above
    }, 500) // Match CSS transition duration
  }, [isTransitioning, sortedPolyhedra.length, visibleIndices])

  // Arrow key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || sortedPolyhedra.length === 0) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleNavigation('left')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNavigation('right')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [loading, sortedPolyhedra.length, handleNavigation])

  if (loading) {
    return (
      <div className="carousel-loading">
        <p>Loading polyhedra...</p>
      </div>
    )
  }

  if (sortedPolyhedra.length === 0) {
    return (
      <div className="carousel-error">
        <p>No polyhedra available</p>
      </div>
    )
  }

  return (
    <div className="carousel-wrapper" ref={carouselRef}>
      <div className="carousel-container">
        {visibleIndices.map((idx, displayIndex) => {
          const polyhedron = sortedPolyhedra[idx]
          // displayIndex 0-4, center is at index 2
          const relativePosition = displayIndex - 2
          const isCenter = relativePosition === 0
          const isVisible = Math.abs(relativePosition) <= 1
          // Only mount canvas if this index is in the mounted set
          // This ensures canvases stay mounted during transitions, then get cleaned up
          const shouldMountCanvas = mountedIndices.has(idx)
          
          return (
            <div
              key={polyhedron.slug}
              className={`carousel-item ${isCenter ? 'center' : 'side'}`}
              style={{
                transform: `translateX(${relativePosition * 480}px) scale(${isCenter ? 1 : 0.85})`,
                opacity: isVisible ? (isCenter ? 1 : 0.6) : 0,
                zIndex: isCenter ? 2 : 1,
                pointerEvents: isVisible ? 'auto' : 'none'
              }}
            >
              {shouldMountCanvas && (
                <PolyhedronViewer
                  key={`viewer-${polyhedron.slug}-${idx}`}
                  dataFile={polyhedron.file}
                  name={polyhedron.name}
                />
              )}
            </div>
          )
        })}
      </div>
      
      <div className="carousel-navigation">
        <button
          className="carousel-nav-button"
          onClick={() => handleNavigation('left')}
          disabled={isTransitioning}
          aria-label="Previous"
        >
          ←
        </button>
        
        <div className="carousel-indicator">
          {currentIndex + 1} / {sortedPolyhedra.length}
        </div>
        
        <button
          className="carousel-nav-button"
          onClick={() => handleNavigation('right')}
          disabled={isTransitioning}
          aria-label="Next"
        >
          →
        </button>
      </div>
      
      <div className="carousel-hint">
        Use arrow keys to navigate
      </div>
    </div>
  )
}

