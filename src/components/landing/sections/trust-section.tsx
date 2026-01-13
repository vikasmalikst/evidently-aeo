"use client"

import { Card } from "@/components/landing/ui/card"
import { MotionDiv, fadeInUp, staggerContainer, defaultAnimationOptions } from "@/lib-landing/animations"
import { Database, TrendingUp, Quote } from "lucide-react"

export function TrustSection() {
  return (
    <section className="relative py-24 lg:py-32 bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <MotionDiv
          className="max-w-5xl mx-auto"
          {...defaultAnimationOptions}
          variants={staggerContainer}
        >
          {/* Section Header */}
          <MotionDiv className="text-center mb-16" variants={fadeInUp}>
            <h3 className="text-3xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-6">
              Why Teams Trust <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">EvidentlyAEO</span>
            </h3>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium">
              No simulations. No guesswork. Just real data and revenue impact.
            </p>
          </MotionDiv>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {/* Value Prop 1: Real Data */}
            <MotionDiv variants={fadeInUp} className="h-full">
              <div className="group h-full p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-[0_0_40px_-10px_rgba(6,182,212,0.15)] hover:border-cyan-500/30 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-cyan-50 dark:bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Database className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
                </div>
                <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">100% Real Data</h4>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  We query AI models directly. Every metric reflects a <span className="font-semibold text-cyan-700 dark:text-cyan-400">real response</span> from a real user query.
                </p>
              </div>
            </MotionDiv>

            {/* Value Prop 2: Outcomes */}
            <MotionDiv variants={fadeInUp} className="h-full">
              <div className="group h-full p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)] hover:border-blue-500/30 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Outcome Driven</h4>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  We don't just track rankings. We measure <span className="font-semibold text-blue-700 dark:text-blue-400">visibility lift</span>, share of answers, and revenue impact.
                </p>
              </div>
            </MotionDiv>
          </div>

          {/* Testimonial - Centered & Elegant */}
          <MotionDiv variants={fadeInUp} className="relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full blur-[60px] opacity-20" />

            <div className="relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-slate-800 rounded-3xl p-10 text-center shadow-lg">
              <Quote className="w-12 h-12 text-cyan-200 dark:text-slate-800 mx-auto mb-6 opacity-50" />

              <blockquote className="text-xl md:text-2xl font-medium text-slate-800 dark:text-slate-200 leading-relaxed max-w-3xl mx-auto mb-8">
                "EvidentlyAEO turned our AI visibility from a black box into a clear growth channel. It's the only tool that gives us <span className="text-cyan-600 dark:text-cyan-400">actionable data</span> we can trust."
              </blockquote>

              <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">VP of Marketing</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Enterprise SaaS Company</span>
                </div>
              </div>
            </div>
          </MotionDiv>

        </MotionDiv>
      </div>
    </section>
  )
}
