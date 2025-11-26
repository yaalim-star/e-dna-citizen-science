import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'e-DNA Citizen Science',
  description: 'e-DNA Citizen Science Project',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

