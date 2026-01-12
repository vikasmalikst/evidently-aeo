import { ScrollToTop } from "@/components/scroll-to-top"
import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/sections/hero-section"
import { FullLoopStrip } from "@/components/sections/full-loop-strip"
import { FeaturesStickyScroll } from "@/components/sections/features-sticky-scroll"
import { HeroFeature1 } from "@/components/sections/hero-feature-1"
import { HeroFeature2 } from "@/components/sections/hero-feature-2"
// import { FeatureGrid } from "@/components/sections/feature-grid"
import { WhyDifferent } from "@/components/sections/why-different"
import { HowItWorks } from "@/components/sections/how-it-works"
import { CaseStudies } from "@/components/sections/case-studies"
import { TrustSection } from "@/components/sections/trust-section"
import { PricingSection } from "@/components/sections/pricing-section"
import { FAQSection } from "@/components/sections/faq-section"
import { CTAStrip } from "@/components/sections/cta-strip"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Win in AI Search Before Your Competitors | EvidentlyAEO - Answer Engine Optimization Intelligence & Execution Platform",
  description:
    "The Answer Engine Optimization intelligence and execution platform. Measure visibility, operationalize insights into actions, and prove measurable business outcomes—not just dashboards.",
  openGraph: {
    title: "Win in AI Search Before Your Competitors | EvidentlyAEO - Answer Engine Optimization Intelligence & Execution Platform",
    description:
      "The Answer Engine Optimization intelligence and execution platform. Measure visibility, operationalize insights into actions, and prove measurable business outcomes—not just dashboards.",
    url: "https://evidentlyaeo.com",
    siteName: "EvidentlyAEO",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <ScrollToTop />
      <Navigation />
      <HeroSection />
      <FullLoopStrip />
      <FeaturesStickyScroll />
      {/* <HeroFeature1 /> */}
      {/* <HeroFeature2 /> */}
      {/* <FeatureGrid /> */}
      {/* <WhyDifferent /> */}
      {/* <HowItWorks /> */}
      {/* <CaseStudies /> */}
      {/* <TrustSection /> */}
      <PricingSection />
      <FAQSection />
      <CTAStrip />
      <Footer />
    </main>
  )
}
