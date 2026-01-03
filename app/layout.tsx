import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Platonic Solids',
  description: 'Geometric Forms in Three Dimensions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}




