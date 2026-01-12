"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { MotionDiv, fadeInUp, slideInLeft, slideInRight, defaultAnimationOptions } from "@/lib/animations"
import { Cover } from "@/components/ui/cover"

export function HeroFeature1() {
  return (
    <section className="relative py-16 lg:py-20 bg-gradient-to-b from-background via-white to-slate-50/50 overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Content - Refocused on Competitive Performance */}
          <MotionDiv
            className="space-y-6 order-2 lg:order-1"
            {...defaultAnimationOptions}
            variants={slideInLeft}
          >
            <div className="space-y-2">
              <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wide">Competitive Intelligence</p>
              <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground leading-tight">
                Know exactly how you stack up against <Cover className="font-bold">competitors</Cover>—see who's winning and why
              </h2>
            </div>

            <p className="text-lg text-muted-foreground leading-relaxed">
              Compare your brand's AI visibility performance side-by-side with up to 5 competitors. See visibility scores, share of answers, sentiment, and brand presence—all in one comprehensive view.
            </p>

            <ul className="space-y-4">
              {[
                "Side-by-side competitive comparison—see your Visibility Score, Share of Answers, and Sentiment Score ranked against top competitors in real-time.",
                "Goal-adaptive benchmarking—benchmarks, tracked prompts, and competitors adapt as campaigns, launches, and market players change. Not static comparisons.",
                "Track competitive trends over time—watch how your position changes relative to competitors with historical data and trend analysis.",
                "Benchmark across all AI platforms—compare performance on ChatGPT, Perplexity, Gemini, Google AI Overviews, and more.",
              ].map((bullet, index) => (
                <MotionDiv
                  key={index}
                  className="flex gap-3 text-foreground"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <CheckCircle2 className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                  <span className="text-base leading-relaxed">{bullet}</span>
                </MotionDiv>
              ))}
            </ul>

            <div className="pt-4">
              <Button
                variant="outline"
                className="gap-2 group bg-transparent hover:bg-accent hover:scale-105 transition-transform"
              >
                View Competitive Analysis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </MotionDiv>

          {/* Right: Competitive Comparison Image - Enhanced */}
          <MotionDiv
            className="order-1 lg:order-2 relative lg:scale-[1.25] xl:scale-[1.3] origin-center"
            {...defaultAnimationOptions}
            variants={slideInRight}
          >
            {/* Decorative gradient border */}
            <div className="absolute -inset-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 rounded-3xl blur-xl opacity-25 group-hover:opacity-40 transition-opacity"></div>
            
            {/* Main image container */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-cyan-500/30 shadow-[0_25px_70px_-15px_rgba(6,182,212,0.25)] bg-white hover:shadow-[0_30px_90px_-15px_rgba(6,182,212,0.35)] transition-all duration-500 hover:scale-[1.03] group">
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none"></div>
              
              {/* Image without scaling to prevent cropping */}
              <img
                src="/competitiveNew.jpeg"
                alt="EvidentlyAEO Competitive Comparison Dashboard showing side-by-side brand performance metrics including Visibility Score, Share of Answers, Brand Presence, and Sentiment Score"
                className="w-full h-auto"
              />
              
              {/* Corner decorations */}
              <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-br-full"></div>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-blue-500/10 to-transparent rounded-tl-full"></div>
            </div>

            {/* Floating competitive insights badge */}
            {/* <MotionDiv
              className="absolute -bottom-4 -right-4 bg-gradient-to-br from-white to-cyan-50 rounded-xl shadow-2xl border-2 border-cyan-200 p-4 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ scale: 1.05, y: -4 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse"></div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Competitive Edge</p>
                  <p className="text-sm font-bold text-foreground">Track 5+ competitors</p>
            </div>
          </div>
            </MotionDiv> */}

            {/* Top floating badge */}
            <MotionDiv
              className="absolute -top-3 -right-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-3 py-1.5 rounded-full shadow-xl text-xs font-semibold flex items-center gap-1.5 z-20"
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              <CheckCircle2 className="w-3 h-3" />
              Live Comparison
            </MotionDiv>
          </MotionDiv>
        </div>
      </div>
    </section>
  )
}
