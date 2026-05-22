'use client'
import { useState } from 'react'
import { List, X } from '@phosphor-icons/react'

const links = [
  { href: '#how', label: 'How it works' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 md:px-12 h-16 bg-[rgba(8,15,10,0.88)] backdrop-blur-xl border-b border-[rgba(0,230,118,0.1)]">
        <a
          href="/"
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
          {links.map(l => (
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
        </div>
      )}
    </>
  )
}
