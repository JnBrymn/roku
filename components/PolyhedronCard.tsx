'use client';

import Link from 'next/link';
import PolyhedronViewer from './PolyhedronViewer';
import { PolyhedronData } from '@/lib/polyhedronParser';

interface PolyhedronCardProps {
  name: string;
  slug: string;
  data: PolyhedronData;
}

export default function PolyhedronCard({ name, slug, data }: PolyhedronCardProps) {
  return (
    <Link 
      href={`/polyhedron/${slug}`}
      style={{
        display: 'block',
        background: '#FFC0CB',
        borderRadius: '8px',
        padding: '1rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        textDecoration: 'none',
        color: 'inherit'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      }}
    >
      <h2 style={{ 
        textAlign: 'center', 
        marginBottom: '1rem',
        fontSize: '1.5rem'
      }}>
        {name}
      </h2>
      <div style={{ height: '300px', borderRadius: '4px', overflow: 'hidden' }}>
        <PolyhedronViewer data={data} autoRotate={true} controls={false} />
      </div>
    </Link>
  );
}

