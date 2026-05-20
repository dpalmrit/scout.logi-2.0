import Nav from './components/Nav'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import SampleAnalysis from './components/SampleAnalysis'
import EarlyAccess from './components/EarlyAccess'
import Footer from './components/Footer'

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <SampleAnalysis />
        <EarlyAccess />
      </main>
      <Footer />
    </>
  )
}
