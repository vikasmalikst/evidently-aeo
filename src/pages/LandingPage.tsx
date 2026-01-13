import { Navigation } from '../components/landing/navigation';
import { HeroSection } from '../components/landing/sections/hero-section';
import { FullLoopStrip } from '../components/landing/sections/full-loop-strip';
import { FeaturesStickyScroll } from '../components/landing/sections/features-sticky-scroll';
import { WhyDifferent } from '../components/landing/sections/why-different';
import { TrustSection } from '../components/landing/sections/trust-section';
import { PricingSection } from '../components/landing/sections/pricing-section';
import { FAQSection } from '../components/landing/sections/faq-section';
import { CTAStrip } from '../components/landing/sections/cta-strip';
import { Footer } from '../components/landing/footer';
import { ScrollToTop } from '../components/landing/scroll-to-top';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background font-sans antialiased landing-scope">
      <ScrollToTop />
      <Navigation />
      <HeroSection />
      <FullLoopStrip />
      <section id="features">
        <FeaturesStickyScroll />
      </section>
      <WhyDifferent />
      <TrustSection />
      {/* <HeroFeature1 /> */}
      {/* <HeroFeature2 /> */}
      {/* <FeatureGrid /> */}
      {/* <HowItWorks /> */}
      {/* <CaseStudies /> */}
      <section id="pricing">
        <PricingSection />
      </section>
      <section id="faq">
        <FAQSection />
      </section>
      <CTAStrip />
      <Footer />
    </main>
  );
}
