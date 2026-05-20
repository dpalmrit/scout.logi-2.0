import { TrendUp, TrendDown, Lightbulb } from '@phosphor-icons/react/dist/ssr'
import ScrollReveal from './ScrollReveal'

const metrics = [
  { name: 'Scanning Rate', score: 87, note: '4.2 pre-receive head checks/min' },
  { name: 'Positioning IQ', score: 79, note: 'Optimal zone 68% of possession' },
  { name: 'First Touch', score: 91, note: 'Clean control: 34 of 37 attempts' },
  { name: 'Decision Speed', score: 82, display: '1.4s', note: '0.7s faster than U16 average' },
]

const tags = ['Midfielder', 'Under 16', 'Right foot', 'League match']

type ObsType = 'positive' | 'negative' | 'neutral'

const obsConfig: Record<ObsType, { color: string; bg: string; Icon: typeof TrendUp }> = {
  positive: { color: '#00e676', bg: 'rgba(0,230,118,0.04)', Icon: TrendUp },
  negative: { color: '#ff6b6b', bg: 'rgba(255,107,107,0.04)', Icon: TrendDown },
  neutral:  { color: '#ffd166', bg: 'rgba(255,209,102,0.04)', Icon: Lightbulb },
}

const observations: { type: ObsType; tag: string; text: string; time: string }[] = [
  {
    type: 'positive',
    tag: 'Strength',
    text: 'Exceptional pre-receive scanning in the final third — consistently identifies runs behind the defensive line before receiving the ball.',
    time: 'Most prominent: 45′ – 90′',
  },
  {
    type: 'positive',
    tag: 'Strength',
    text: 'Strong composure under high pressure — 7 of 9 correct decisions in press situations. Impressive for this age group.',
    time: 'Observed throughout',
  },
  {
    type: 'negative',
    tag: 'Area to improve',
    text: 'Positional discipline drops when the team loses shape — tends to drift wide unnecessarily, opening gaps in central midfield.',
    time: 'Visible: 18′ – 28′',
  },
  {
    type: 'neutral',
    tag: 'Recommended focus',
    text: 'Left-foot distribution is 22% below right-foot baseline. Targeted training on weaker-foot passing would significantly improve the overall rating.',
    time: 'Full match',
  },
]

export default function SampleAnalysis() {
  return (
    <section className="relative z-10 border-t" style={{ borderColor: 'rgba(0,230,118,0.07)' }}>
      <div className="max-w-[1100px] mx-auto px-8 md:px-12 py-24 md:py-32">
        <div className="text-[11px] font-bold tracking-[0.22em] uppercase mb-3" style={{ color: '#00e676' }}>Sample Analysis</div>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none mb-4">What your report looks like</h2>
        <p className="leading-relaxed mb-12 max-w-[440px]" style={{ color: '#7a9982' }}>
          Precise metrics, AI observations, and coaching insights — delivered the moment analysis is complete.
        </p>

        {/* Player header */}
        <ScrollReveal>
          <div
            className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-8 border-b"
            style={{ borderColor: 'rgba(0,230,118,0.1)' }}
          >
            <div className="flex items-center gap-5">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-extrabold shrink-0"
                style={{ background: '#122018', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}
              >
                #7
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2" style={{ color: '#e8f5ec' }}>Player Analysis Summary — Jersey #7</h3>
                <div className="flex gap-2 flex-wrap">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="rounded-full px-3 py-1 text-xs font-medium border"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', color: '#7a9982' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end">
              <div className="text-7xl font-extrabold tracking-tighter leading-none" style={{ color: '#00e676' }}>B+</div>
              <div className="text-sm font-medium mt-1" style={{ color: '#e8f5ec' }}>Above average for age group</div>
              <div className="text-xs mt-0.5" style={{ color: '#7a9982' }}>Potential flagged for further review</div>
            </div>
          </div>
        </ScrollReveal>

        {/* Metrics — gap-px bento technique */}
        <ScrollReveal delay={100}>
          <div
            className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden mb-8"
            style={{ gap: '1px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.12)' }}
          >
            {metrics.map(m => (
              <div
                key={m.name}
                className="px-5 py-6 text-center transition-colors duration-200 cursor-default bg-[#0d1a10] hover:bg-[#122018]"
              >
                <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#7a9982' }}>{m.name}</div>
                <div className="text-3xl font-extrabold leading-none mb-1" style={{ color: '#00e676' }}>
                  {m.display || m.score}
                  {!m.display && <span className="text-base font-normal opacity-40">/100</span>}
                </div>
                <div className="h-[3px] rounded-full mx-auto overflow-hidden mb-2" style={{ maxWidth: '80px', background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${m.score}%`, background: '#00e676' }} />
                </div>
                <div className="text-[11px] leading-snug" style={{ color: '#7a9982' }}>{m.note}</div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Observations */}
        <div className="text-[11px] font-bold uppercase tracking-widest mb-5" style={{ color: '#7a9982' }}>AI Coach Observations</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {observations.map((obs, i) => {
            const cfg = obsConfig[obs.type]
            const { Icon } = cfg
            return (
              <ScrollReveal key={i} delay={i * 80}>
                <div
                  className="rounded-xl p-5 border transition-transform duration-200 hover:-translate-y-[1px]"
                  style={{
                    borderColor: `${cfg.color}20`,
                    background: cfg.bg,
                    borderLeftColor: cfg.color,
                    borderLeftWidth: '3px',
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={13} weight="bold" style={{ color: cfg.color, flexShrink: 0 }} />
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>{obs.tag}</span>
                  </div>
                  <p className="text-sm leading-relaxed mb-3" style={{ color: '#e8f5ec' }}>{obs.text}</p>
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: '#7a9982' }}>
                    <span className="w-1 h-1 rounded-full inline-block" style={{ background: '#7a9982' }} />
                    {obs.time}
                  </div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal delay={300}>
          <div className="text-center">
            <a
              href="https://pitchscout.ai/coach-register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded font-bold tracking-wide uppercase transition-all duration-300 bg-[#00e676] text-[#080f0a] hover:bg-[#26f078] hover:-translate-y-[1px] active:scale-[0.98]"
              style={{ textDecoration: 'none' }}
            >
              Get this for your team
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
