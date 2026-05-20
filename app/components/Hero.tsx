import { ArrowRight, CheckCircle } from '@phosphor-icons/react/dist/ssr'

const metrics = [
  { name: 'Scanning Rate', score: 87, display: '87' },
  { name: 'Positioning IQ', score: 79, display: '79' },
  { name: 'First Touch', score: 91, display: '91' },
  { name: 'Decision Speed', score: 82, display: '1.4s' },
]

const trust = [
  'No subscription fees during early access',
  'Works with any camera or phone footage',
  'Player privacy protected — no names stored',
]

export default function Hero() {
  return (
    <section className="relative z-10 grid grid-cols-1 lg:grid-cols-[55%_45%] min-h-[100dvh]">
      {/* Left: content */}
      <div className="flex flex-col justify-center px-8 md:px-16 lg:px-[80px] pt-28 pb-16 lg:py-0">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2.5 w-fit mb-8 rounded-full px-4 py-2 border"
          style={{ background: 'rgba(0,230,118,0.08)', borderColor: 'rgba(0,230,118,0.22)' }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00e676' }} />
          <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: '#00e676' }}>
            AI-Powered Soccer Analysis
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-[64px] font-extrabold tracking-tight leading-none mb-6">
          Turn match footage into
          <span className="block mt-1" style={{ color: '#00e676' }}>actionable player insights.</span>
        </h1>

        {/* Sub */}
        <p className="text-base leading-relaxed mb-8 max-w-[440px]" style={{ color: '#7a9982' }}>
          Upload a clip. Our AI scouts every touch, run, and decision — and delivers a detailed performance report once analysis is complete. No subscriptions. No setup. Just results.
        </p>

        {/* CTAs */}
        <div className="flex gap-4 flex-wrap mb-10">
          <a
            href="https://pitchscout.ai/coach-register"
            className="inline-flex items-center gap-2 px-6 py-3 rounded font-bold text-sm tracking-wide uppercase transition-all duration-300 hover:-translate-y-[1px] active:scale-[0.98]"
            style={{ background: '#00e676', color: '#080f0a', boxShadow: '0 0 0 rgba(0,230,118,0)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 6px 22px rgba(0,230,118,0.22)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 0 rgba(0,230,118,0)' }}
          >
            For coaches <ArrowRight size={15} weight="bold" />
          </a>
          <a
            href="#how"
            className="inline-flex items-center gap-2 px-6 py-3 rounded font-semibold text-sm tracking-wide uppercase border transition-all duration-300"
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
            How it works
          </a>
        </div>

        {/* Trust */}
        <div className="flex flex-col gap-2.5">
          {trust.map(item => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle size={14} weight="fill" style={{ color: '#00e676', flexShrink: 0 }} />
              <span className="text-xs" style={{ color: '#7a9982' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: floating analysis card */}
      <div
        className="hidden lg:flex items-center justify-center px-8 xl:px-14 py-24 border-l"
        style={{ borderColor: 'rgba(0,230,118,0.06)' }}
      >
        <div
          className="float-card w-full max-w-[380px] rounded-2xl overflow-hidden"
          style={{
            background: '#0d1a10',
            border: '1px solid rgba(0,230,118,0.2)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45), 0 0 40px rgba(0,230,118,0.06)',
          }}
        >
          {/* Card top bar */}
          <div className="flex items-start justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(0,230,118,0.1)' }}>
            <div>
              <div className="text-[10px] font-bold tracking-[0.18em] uppercase mb-1" style={{ color: '#7a9982' }}>Analysis Preview</div>
              <div className="font-bold text-sm" style={{ color: '#e8f5ec' }}>Jersey #7 — Midfielder</div>
              <div className="text-xs mt-0.5" style={{ color: '#7a9982' }}>Under 16 &middot; League Match</div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(0,230,118,0.1)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00e676' }} />
              <span className="text-[10px] font-bold tracking-wide" style={{ color: '#00e676' }}>LIVE</span>
            </div>
          </div>

          {/* Grade */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(0,230,118,0.1)' }}>
            <div>
              <div className="text-[10px] font-bold tracking-[0.18em] uppercase mb-0.5" style={{ color: '#7a9982' }}>Overall Grade</div>
              <div className="text-xs" style={{ color: '#e8f5ec' }}>Above avg for age group</div>
              <div className="text-[10px] mt-0.5" style={{ color: '#7a9982' }}>Potential flagged for review</div>
            </div>
            <div className="text-6xl font-extrabold tracking-tighter leading-none" style={{ color: '#00e676' }}>B+</div>
          </div>

          {/* Metric bars */}
          <div className="px-5 py-5 space-y-3.5">
            {metrics.map(m => (
              <div key={m.name} className="flex items-center gap-3">
                <div className="text-[11px] w-[108px] shrink-0" style={{ color: '#7a9982' }}>{m.name}</div>
                <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${m.score}%`, background: '#00e676' }} />
                </div>
                <div className="text-xs font-bold w-8 text-right" style={{ color: '#00e676' }}>{m.display}</div>
              </div>
            ))}
          </div>

          {/* Card footer */}
          <div className="px-5 py-3 border-t" style={{ background: 'rgba(0,230,118,0.03)', borderColor: 'rgba(0,230,118,0.07)' }}>
            <div className="text-[10px] text-center" style={{ color: '#7a9982' }}>Sample analysis &middot; Real AI output</div>
          </div>
        </div>
      </div>
    </section>
  )
}
