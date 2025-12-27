import Link from 'next/link';
import { readFileSync } from 'fs';
import { join } from 'path';
import { notFound } from 'next/navigation';
import PolyhedronViewer from '@/components/PolyhedronViewer';
import { parsePolyhedronFile } from '@/lib/polyhedronParser';

const polyhedrons: Record<string, string> = {
  tetrahedron: 'tetrahedron.txt',
  cube: 'cube.txt',
  octahedron: 'octahedron.txt',
  dodecahedron: 'dodecahedron.txt',
  icosahedron: 'icosahedron.txt',
};

export default function PolyhedronPage({ params }: { params: { slug: string } }) {
  const file = polyhedrons[params.slug];
  
  if (!file) {
    notFound();
  }
  
  const filePath = join(process.cwd(), 'data', file);
  const content = readFileSync(filePath, 'utf-8');
  const data = parsePolyhedronFile(content);
  
  const name = Object.keys(polyhedrons).find(key => polyhedrons[key] === file) || params.slug;
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  
  return (
    <main style={{ 
      minHeight: '100vh', 
      padding: '2rem',
      background: '#FFB6C1'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Link 
          href="/"
          style={{
            display: 'inline-block',
            marginBottom: '2rem',
            color: '#333',
            textDecoration: 'underline',
            fontSize: '1.1rem'
          }}
        >
          ← Back to Home
        </Link>
        
        <h1 style={{ 
          textAlign: 'center', 
          marginBottom: '2rem',
          fontSize: '2.5rem',
          color: '#333'
        }}>
          {displayName}
        </h1>
        
        <div style={{ 
          height: '80vh', 
          borderRadius: '8px', 
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <PolyhedronViewer data={data} autoRotate={false} controls={false} />
        </div>
      </div>
    </main>
  );
}

