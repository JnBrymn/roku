import { notFound } from 'next/navigation'
import GoPolyhedronViewer from '@/components/GoPolyhedronViewer'
import { polyhedraData } from '@/lib/polyhedronUtils'

export async function generateStaticParams() {
  return polyhedraData.map((poly) => ({
    name: poly.slug,
  }))
}

export default function GoPolyhedronPage({ params }: { params: { name: string } }) {
  const polyhedron = polyhedraData.find((p) => p.slug === params.name)

  if (!polyhedron) {
    notFound()
  }

  return <GoPolyhedronViewer dataFile={polyhedron.file} name={polyhedron.name} />
}

