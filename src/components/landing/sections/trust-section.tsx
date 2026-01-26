"use client"

import { MotionDiv, fadeInUp, staggerContainer, defaultAnimationOptions } from "@/lib-landing/animations"
import { Database, TrendingUp, Quote, CheckCircle2 } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { motion, useInView, useSpring, useMotionValue, useTransform } from "framer-motion"

// Animated Counter Component
function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const springValue = useSpring(0, {
    damping: 30,
    stiffness: 100,
  })
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  useEffect(() => {
    if (isInView) {
      springValue.set(value)
    }
  }, [isInView, value, springValue])

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Math.floor(latest) + suffix
      }
    })
  }, [springValue, suffix])

  return <span ref={ref} />
}

export function TrustSection() {
  return (
    <section className="relative py-24 lg:py-32 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden">
      {/* Background decoration - Animated Mesh */}
      <div className="absolute inset-0 -z-10">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl opacity-50 pointer-events-none" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.5, 1],
            rotate: [0, -45, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full blur-3xl opacity-30 pointer-events-none" 
        />
      </div>

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <MotionDiv
          className="max-w-5xl mx-auto"
          {...defaultAnimationOptions}
          variants={staggerContainer}
        >
          {/* Section Header */}
          <MotionDiv className="text-center mb-16" variants={fadeInUp}>
            <span className="inline-block px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-semibold tracking-wide uppercase mb-4">
              Trusted Accuracy
            </span>
            <h3 className="text-3xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-6">
              Why Teams Trust <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">EvidentlyAEO</span>
            </h3>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium">
              No simulations. No guesswork. Just real data and revenue impact.
            </p>
          </MotionDiv>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
            {/* Value Prop 1: Real Data */}
            <MotionDiv variants={fadeInUp} className="h-full">
              <div className="group h-full p-8 lg:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-[0_0_50px_-10px_rgba(6,182,212,0.2)] hover:border-cyan-500/50 transition-all duration-300 relative overflow-hidden">
                {/* Hover Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-500/30 transition-all duration-500" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-inner">
                      <Database className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div className="text-4xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                      <Counter value={100} suffix="%" />
                    </div>
                  </div>
                  
                  <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">Real Data Accuracy</h4>
                  <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                    We query AI models directly. Every metric reflects a <span className="font-semibold text-cyan-700 dark:text-cyan-400">real response</span> from a real user query.
                  </p>
                </div>
              </div>
            </MotionDiv>

            {/* Value Prop 2: Outcomes */}
            <MotionDiv variants={fadeInUp} className="h-full">
              <div className="group h-full p-8 lg:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-[0_0_50px_-10px_rgba(59,130,246,0.2)] hover:border-blue-500/50 transition-all duration-300 relative overflow-hidden">
                {/* Hover Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/30 transition-all duration-500" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shadow-inner">
                      <TrendingUp className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                    </div>
                     <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase">
                      <CheckCircle2 className="w-4 h-4" /> Proven
                    </span>
                  </div>
                  
                  <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Outcome Driven</h4>
                  <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                    We don't just track rankings. We measure <span className="font-semibold text-blue-700 dark:text-blue-400">visibility lift</span>, share of answers, and revenue impact.
                  </p>
                </div>
              </div>
            </MotionDiv>
          </div>

          {/* Testimonial - Premium Card */}
          <MotionDiv variants={fadeInUp} className="relative max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[2.5rem] rotate-1 opacity-20 blur-sm scale-[0.98]" />
            <div className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 md:p-12 shadow-2xl">
              <Quote className="w-16 h-16 text-cyan-100 dark:text-slate-800 absolute top-8 left-8 -z-10" />
              
              <div className="text-center">
                 <div className="w-20 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto mb-8 opacity-50" />
                 
                <blockquote className="text-xl md:text-2xl lg:text-3xl font-medium text-slate-800 dark:text-slate-200 leading-snug mb-10">
                  "EvidentlyAEO turned our AI visibility from a black box into a clear growth channel. It's the only tool that gives us <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 font-bold">actionable data</span> we can trust."
                </blockquote>

                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 mb-2 border-2 border-white dark:border-slate-900 shadow-md" />
                  <cite className="not-italic text-base font-bold text-slate-900 dark:text-white">VP of Marketing</cite>
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-wide">Enterprise SaaS Company</span>
                </div>
              </div>
            </div>
          </MotionDiv>

        </MotionDiv>
      </div>
    </section>
  )
}
