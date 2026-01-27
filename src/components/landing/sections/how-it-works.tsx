"use client"

import { MotionDiv, fadeInUp, staggerContainer, defaultAnimationOptions } from "@/lib-landing/animations"
import { CheckCircle2, ArrowRight } from "lucide-react"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"

const fullLoopSteps = [
  {
    number: "01",
    title: "Measure",
    description: "Benchmark LLM related KPIs using our sophisticated trackers.",
    details: "Track your brand's visibility across ChatGPT, Perplexity, Gemini, and Google AI Overviews. Monitor share of answers and sentiment with leading indicators like citation depth and attribution.",
  },
  {
    number: "02",
    title: "Analyze",
    description: "Deep insights powered by proprietary algorithms.",
    details: "Identify performance gaps by topic, intent, and channel. Our sophisticated algorithms analyze the collected data to understand exactly where competitors are winning and why.",
  },
  {
    number: "03",
    title: "Optimize",
    description: "Continuous performance optimization for your brand.",
    details: "Turn insights into action with prioritized recommendations. Use our closed-loop system to continuously optimize your brand's presence and dominate answer engine results.",
  },
]

function FullLoopCardGrid({ steps }: { steps: Array<{ number: string; title: string; description: string; details: string }> }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-6 relative">
      {steps.map((step, index) => (
        <div
          key={index}
          className="relative group block p-2 h-full w-full"
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence>
            {hoveredIndex === index && (
              <motion.span
                className="absolute inset-0 h-full w-full bg-cyan-50 dark:bg-slate-800/[0.8] block rounded-xl"
                layoutId="hoverBackgroundStep"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { duration: 0.15 },
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.15, delay: 0.2 },
                }}
              />
            )}
          </AnimatePresence>
          <div className="relative z-20 bg-white rounded-xl border border-border p-6 lg:p-8 group-hover:border-cyan-300 group-hover:shadow-lg transition-all duration-300 h-full">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{step.number}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground">{step.title}</h3>
                </div>
              </div>
              <p className="text-base font-semibold text-foreground">{step.description}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.details}</p>
            </div>
          </div>

        </div>
      ))}
    </div>
  )
}

export function HowItWorks() {
  return (
    <section className="relative py-16 lg:py-20 bg-gradient-to-b from-background via-cyan-50/20 to-background overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-0 w-full h-full bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_0%,rgba(6,182,212,0.03)_50%,transparent_100%)]"></div>
      </div>
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <MotionDiv
          className="text-center mb-12 space-y-4"
          {...defaultAnimationOptions}
          variants={fadeInUp}
        >
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground">
            The 3 Pillars of AEO Success
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Most AEO tools stop at visibility reports. EvidentlyAEO is the only full-loop Answer Engine Optimization system that goes from measurement to measurable business outcomes.
          </p>
        </MotionDiv>

        <div className="relative">
          <FullLoopCardGrid steps={fullLoopSteps} />
        </div>

        <MotionDiv
          className="mt-12 text-center"
          {...defaultAnimationOptions}
          variants={fadeInUp}
          transition={{ delay: 0.4 }}
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-50 rounded-full border border-cyan-200">
            <CheckCircle2 className="w-5 h-5 text-cyan-600" />
            <span className="text-sm font-semibold text-foreground">
              First results within 24 hours
            </span>
          </div>
        </MotionDiv>
      </div>
    </section>
  )
}

