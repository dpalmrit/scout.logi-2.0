import { ArrowRight, CheckCircle } from '@phosphor-icons/react/dist/ssr'
import ScrollReveal from './ScrollReveal'

const trustItems = [
  'No subscription fees during early access',
  'Works with footage from any camera or phone',
  'Player privacy fully protected — no names stored',
  'Designed for youth academies, clubs, and independent scouts',
]

export default function EarlyAccess() {
  return (
    <section
      id="early-access"
      className="relative z-10 border-t"
      style={{ borderColor: 'rgba(0,230,118,0.07)', background: 'linear-gradient(135deg, rgba(0,230,118,0.04) 0%, transparent 55%)' }}
    >
      <div className="max-w-[1100px] mx-auto px-8 md:px-12 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Left */}
          <ScrollReveal>
            <div>
              <div className="text-[11px] font-bold tracking-[0.22em] uppercase mb-4" style={{ color: '#00e676' }}>Early Access</div>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none mb-6">
                Be first to scout smarter.
              </h2>
              <p className="leading-relaxed mb-8 max-w-[420px]" style={{ color: '#7a9982' }}>
                PitchScout AI is launching ahead of the fall season. Join the list and we'll reach out with priority access — free to try, no commitment required.
              </p>
              <a
                href="https://pitchscout.ai/coach-register"
                className="inline-flex items-center gap-2 px-8 py-4 rounded font-bold tracking-wide uppercase transition-all duration-300 bg-[#00e676] text-[#080f0a] hover:bg-[#26f078] hover:-translate-y-[1px] active:scale-[0.98]"
                style={{ textDecoration: 'none' }}
              >
                Request access <ArrowRight size={15} weight="bold" />
              </a>
            </div>
          </ScrollReveal>

          {/* Right: trust items */}
          <ScrollReveal delay={150}>
            <div className="flex flex-col gap-3 lg:pt-14">
              {trustItems.map(item => (
                <div
                  key={item}
                  className="flex items-start gap-4 p-4 rounded-xl border transition-colors duration-200 border-[rgba(0,230,118,0.08)] hover:border-[rgba(0,230,118,0.18)]"
                  style={{ background: 'rgba(0,230,118,0.02)' }}
                >
                  <CheckCircle size={20} weight="fill" style={{ color: '#00e676', flexShrink: 0, marginTop: 1 }} />
                  <span className="text-sm leading-relaxed" style={{ color: '#e8f5ec' }}>{item}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
