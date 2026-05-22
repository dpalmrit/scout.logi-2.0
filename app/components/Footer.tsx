export default function Footer() {
  const links = [
    { href: 'mailto:support@pitchscout.ai', label: 'Contact' },
  ]

  return (
    <footer className="relative z-10 border-t" style={{ borderColor: 'rgba(0,230,118,0.07)' }}>
      <div className="max-w-[1100px] mx-auto px-8 md:px-12 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <a
          href="/"
          className="font-bold text-base tracking-widest uppercase"
          style={{ color: '#00e676', textDecoration: 'none' }}
        >
          PitchScout AI
        </a>
        <ul className="flex gap-6 list-none m-0 p-0 flex-wrap">
          {links.map(l => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-xs transition-colors duration-200 text-[#7a9982] hover:text-[#e8f5ec]"
                style={{ textDecoration: 'none' }}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="text-xs" style={{ color: 'rgba(122,153,130,0.4)' }}>
          &copy; 2025 PitchScout AI. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
