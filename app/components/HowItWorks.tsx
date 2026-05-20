import { IdentificationCard, Upload, ChartBar } from '@phosphor-icons/react/dist/ssr'
import ScrollReveal from './ScrollReveal'

const steps = [
  {
    num: '01',
    Icon: IdentificationCard,
    title: 'Tell us about the player',
    description: 'Enter the jersey number, position, and age group so the AI tracks the right player throughout the entire match.',
  },
  {
    num: '02',
    Icon: Upload,
    title: 'Upload your footage',
    description: 'Drop in any MP4, MOV, or AVI file up to 5 GB. We handle the processing — fast, encrypted, and completely private.',
  },
  {
    num: '03',
    Icon: ChartBar,
    title: 'Get your analysis summary',
    description: "You'll receive a detailed breakdown of technical scores, positioning patterns, and coaching recommendations once analysis has been completed.",
  },
]

export default function HowItWorks() {
  return (
    <section id="how" className="relative z-10 border-t" style={{ borderColor: 'rgba(0,230,118,0.07)' }}>
      <div className="max-w-[1100px] mx-auto px-8 md:px-12 py-24 md:py-32">
        <div className="text-[11px] font-bold tracking-[0.22em] uppercase mb-3" style={{ color: '#00e676' }}>How it works</div>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none mb-4">Three steps to a full analysis</h2>
        <p className="leading-relaxed mb-16 max-w-[440px]" style={{ color: '#7a9982' }}>
          No complicated setup. No specialist hardware. Just upload footage and let the AI do the work.
        </p>

        {/* Steps — vertical asymmetric list, not 3-col cards */}
        <div>
          {steps.map((step, i) => {
            const { Icon } = step
            return (
              <ScrollReveal key={step.num} delay={i * 110}>
                <div className="grid grid-cols-[64px_1fr] md:grid-cols-[96px_1fr] gap-4 md:gap-10 pb-10 mb-10 border-b last:border-b-0 last:pb-0 last:mb-0" style={{ borderColor: 'rgba(0,230,118,0.07)' }}>
                  <div
                    className="text-[56px] md:text-[80px] font-extrabold leading-none select-none pt-2"
                    style={{ color: 'rgba(0,230,118,0.07)' }}
                  >
                    {step.num}
                  </div>
                  <div className="py-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(0,230,118,0.1)' }}
                      >
                        <Icon size={20} weight="duotone" style={{ color: '#00e676' }} />
                      </div>
                      <h3 className="font-bold text-lg md:text-xl" style={{ color: '#e8f5ec' }}>{step.title}</h3>
                    </div>
                    <p className="leading-relaxed ml-[52px]" style={{ color: '#7a9982' }}>{step.description}</p>
                  </div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        {/* Video embed */}
        <ScrollReveal delay={350}>
          <div
            className="relative mt-16 rounded-xl overflow-hidden aspect-video"
            style={{ background: '#040a06', border: '1px solid rgba(0,230,118,0.14)' }}
          >
            <iframe
              className="absolute inset-0 w-full h-full border-0"
              src="https://www.youtube.com/embed/injR_XDnidk"
              title="PitchScout AI demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
