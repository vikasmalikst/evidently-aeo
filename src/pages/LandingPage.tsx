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
import { SEO } from '../components/SEO';

export default function LandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "EvidentlyAEO",
        "applicationCategory": "MarketingApplication",
        "operatingSystem": "Web",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free trial available"
        },
        "description": "The world's first full-loop Answer Engine Optimization (AEO) platform that empowers marketing leaders to measure, optimize, and dominate AI-driven search results."
      },
      {
        "@type": "Organization",
        "name": "EvidentlyAEO",
        "url": "https://evidentlyaeo.com",
        "logo": "https://evidentlyaeo.com/assets/logo.png",
        "sameAs": [
          "https://twitter.com/evidentlyaeo",
          "https://linkedin.com/company/evidentlyaeo"
        ]
      }
    ]
  };

  return (
    <main className="min-h-screen bg-background font-sans antialiased landing-scope">
      <SEO
        title="EvidentlyAEO - World's First Answer Engine Optimization Platform"
        description="Measure, optimize, and dominate AI search results across ChatGPT, Gemini, Perplexity, and more with the only full-loop AEO platform for marketing leaders."
        canonical="https://evidentlyaeo.com"
        structuredData={structuredData}
      />
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
