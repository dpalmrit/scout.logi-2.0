'use client'
import { useState } from 'react'
import { List, X } from '@phosphor-icons/react'

const links = [
  { href: '#how', label: 'How it works' },
  { href: 'https://pitchscout.ai/coach', label: 'For clubs' },
  { href: 'https://pitchscout.ai/privacy', label: 'Privacy' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 md:px-12 h-16 bg-[rgba(8,15,10,0.88)] backdrop-blur-xl border-b border-[rgba(0,230,118,0.1)]">
        <a
          href="https://pitchscout.ai/"
          className="font-bold text-lg tracking-widest uppercase no-underline leading-none"
          style={{ color: '#00e676', textDecoration: 'none' }}
        >PitchScout<span style={{ color: '#e8f5ec', opacity: 0.45 }}> AI</span></a>

        <ul className="hidden lg:flex items-center gap-8 list-none m-0 p-0">
          {links.map(l => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-sm font-medium tracking-wide transition-colors duration-200"
                style={{ color: '#7a9982', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#e8f5ec')}
                onMouseLeave={e => (e.currentTarget.style.color = '#7a9982')}
              >
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href="https://pitchscout.ai/index"
              className="text-sm font-semibold tracking-wide px-4 py-2 rounded border transition-all duration-200"
              style={{ color: '#e8f5ec', borderColor: 'rgba(255,255,255,0.14)', textDecoration: 'none' }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#00e676'
                e.currentTarget.style.borderColor = 'rgba(0,230,118,0.35)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#e8f5ec'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'
              }}
            >
              Parent sign in
            </a>
          </li>
          <li>
            <a
              href="https://pitchscout.ai/coach-register"
              className="text-sm font-bold tracking-wide px-5 py-2 rounded transition-all duration-200 active:scale-[0.98]"
              style={{ background: '#00e676', color: '#080f0a', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#39ff8a')}
              onMouseLeave={e => (e.currentTarget.style.background = '#00e676')}
            >
              Get started
            </a>
          </li>
        </ul>

        <button
          className="lg:hidden p-1 bg-transparent border-none cursor-pointer"
          style={{ color: '#e8f5ec' }}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={24} /> : <List size={24} />}
        </button>
      </nav>

      {open && (
        <div className="lg:hidden fixed top-16 left-0 right-0 z-40 flex flex-col px-6 pb-8 pt-2 border-b border-[rgba(0,230,118,0.1)] bg-[rgba(8,15,10,0.97)] backdrop-blur-xl">
          {[...links, { href: 'https://pitchscout.ai/index', label: 'Parent sign in' }].map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="py-4 text-base border-b border-[rgba(0,230,118,0.07)] transition-colors duration-200"
              style={{ color: '#7a9982', textDecoration: 'none' }}
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://pitchscout.ai/coach-register"
            onClick={() => setOpen(false)}
            className="mt-6 py-4 text-sm font-bold tracking-widest uppercase text-center rounded-lg"
            style={{ background: '#00e676', color: '#080f0a', textDecoration: 'none' }}
          >
            Get started
          </a>
        </div>
      )}
    </>
  )
}
