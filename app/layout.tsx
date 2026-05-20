import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'PitchScout AI — Soccer Video Analysis',
  description: 'Upload match footage. Our AI scouts every touch, run, and decision — delivering a detailed performance report for any player.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="font-outfit">{children}</body>
    </html>
  )
}
