import { notFound } from 'next/navigation'
import FullScreenPolyhedronViewer from '@/components/FullScreenPolyhedronViewer'
import { polyhedraData } from '@/lib/polyhedronUtils'

export async function generateStaticParams() {
  return polyhedraData.map((poly) => ({
    name: poly.slug,
  }))
}

export default function PolyhedronPage({ params }: { params: { name: string } }) {
  const polyhedron = polyhedraData.find((p) => p.slug === params.name)

  if (!polyhedron) {
    notFound()
  }

  return <FullScreenPolyhedronViewer dataFile={polyhedron.file} name={polyhedron.name} />
}

