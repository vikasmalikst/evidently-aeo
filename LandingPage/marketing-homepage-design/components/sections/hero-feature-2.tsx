"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { MotionDiv, fadeInUp, slideInLeft, slideInRight, defaultAnimationOptions } from "@/lib/animations"
import { Cover } from "@/components/ui/cover"

export function HeroFeature2() {
  return (
    <section className="relative py-16 lg:py-20 bg-gradient-to-br from-slate-50 via-cyan-50/20 to-blue-50/30 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-gradient-to-br from-cyan-400/10 to-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-tr from-blue-400/10 to-cyan-500/5 rounded-full blur-3xl"></div>
        {/* Subtle diagonal lines */}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(6,182,212,0.03)_50%,transparent_100%)]"></div>
      </div>
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 xl:gap-20 items-center">
          {/* Left: Screenshots - Enhanced with better design */}
          <MotionDiv
            className="relative space-y-6 lg:scale-[1.12] xl:scale-[1.15] origin-center"
            {...defaultAnimationOptions}
            variants={slideInLeft}
          >
            {/* First Recommendations Image */}
            <div className="relative group">
              {/* Gradient border glow */}
              <div className="absolute -inset-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 rounded-2xl blur-lg opacity-20 group-hover:opacity-35 transition-opacity duration-500"></div>
              
              {/* Main container */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-cyan-500/30 shadow-[0_20px_60px_-15px_rgba(6,182,212,0.3)] bg-white hover:shadow-[0_25px_80px_-15px_rgba(6,182,212,0.4)] transition-all duration-500 hover:scale-[1.02]">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none"></div>
                
                {/* Image without scaling to prevent cropping */}
                <img
                  src="/recommendationsNew.jpeg"
                  alt="EvidentlyAEO AI-specific optimization recommendations showing actionable insights and content guidance"
                className="w-full h-auto"
              />
                
                {/* Top corner accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-cyan-500/15 to-transparent rounded-bl-full"></div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-3 -right-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-semibold z-20">
                AI Insights
              </div>
            </div>

            {/* Second Recommendations Image */}
            <div className="relative group">
              {/* Gradient border glow */}
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-400 via-cyan-500 to-blue-400 rounded-2xl blur-lg opacity-20 group-hover:opacity-35 transition-opacity duration-500"></div>
              
              {/* Main container */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-blue-500/30 shadow-[0_20px_60px_-15px_rgba(37,99,235,0.3)] bg-white hover:shadow-[0_25px_80px_-15px_rgba(37,99,235,0.4)] transition-all duration-500 hover:scale-[1.02]">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none"></div>
                
                {/* Image without scaling to prevent cropping */}
                <img
                  src="/RecommendationsNew2.jpeg"
                  alt="EvidentlyAEO detailed recommendations panel with specific optimization strategies and impact metrics"
                  className="w-full h-auto"
                />
                
                {/* Bottom corner accent */}
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-blue-500/15 to-transparent rounded-tr-full"></div>
          </div>

              {/* Floating badge */}
              <div className="absolute -bottom-3 -left-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-semibold z-20">
                Action Items
              </div>
            </div>
          </MotionDiv>

          {/* Right: Content */}
          <MotionDiv
            className="space-y-6 lg:pl-4 xl:pl-6"
            {...defaultAnimationOptions}
            variants={slideInRight}
          >
            <div className="space-y-2">
              <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wide">Smart Recommendations</p>
              <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground leading-tight">
                Get AI-specific optimization <Cover className="font-bold">recommendations</Cover>—not generic SEO advice
              </h2>
            </div>

            <ul className="space-y-4">
              {[
                "Platform-specific guidance—what works for ChatGPT differs from Perplexity. Our recommendations account for each model's unique preferences.",
                "Entity-based insights—fix topical authority, not just keyword rankings. Become the definitive source for your category.",
                "AI-assisted content generation—workflows for creating answer-ready assets (Q&A, structured data, FAQs, expert POVs) aligned to answer engine requirements.",
                "Execution playbooks—structured guidance for marketing, content, PR, and product teams tailored to answer engines. Know exactly what to change and how.",
                "Content roadmap—prioritized fixes with estimated visibility lift. Know which changes move the needle most.",
              ].map((bullet, index) => (
                <MotionDiv
                  key={index}
                  className="flex gap-3 text-foreground"
                  initial={{ opacity: 0, x: 20 }}
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
                View Sample Recommendations
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </MotionDiv>
        </div>
      </div>
    </section>
  )
}
