"use client"

import { MotionDiv, fadeInUp, staggerContainer, defaultAnimationOptions } from "@/lib-landing/animations"
import { ArrowRight, TrendingUp, Target, RefreshCw } from "lucide-react"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"

const differentiators = [
  {
    icon: TrendingUp,
    title: "From Tracking to Orchestrating Outcomes",
    description:
      "Most AEO tools stop at visibility reports. EvidentlyAEO bakes in workflows: Discover Opportunities → To-Do List → Review and Refine → Track Outcomes. We ensure changes actually ship, not just get recommended.",
    highlight: "Ensures changes actually ship",
  },
  {
    icon: Target,
    title: "From SaaS to Outcome-as-a-Service",
    description:
      "Others sell subscriptions and dashboards. EvidentlyAEO ties success to improved share of answers, visibility lift, and sentiment improvement—supported by optional professional services.",
    highlight: "Success tied to outcomes, not seats",
  },
  {
    icon: RefreshCw,
    title: "From Static to Goal-Adaptive Benchmarking",
    description:
      "Most tools benchmark across engines and time. EvidentlyAEO adapts benchmarks, tracked prompts, and competitors as campaigns, launches, and market players change.",
    highlight: "Benchmarks adapt to your strategy",
  },
]

function DifferentiatorCardGrid({
  differentiators,
}: {
  differentiators: Array<{ icon: any; title: string; description: string; highlight: string }>
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {differentiators.map((differentiator, index) => {
        const Icon = differentiator.icon
        return (
          <div
            key={index}
            className="relative group block p-2 h-full w-full"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <AnimatePresence>
              {hoveredIndex === index && (
                <motion.span
                  className="absolute inset-0 h-full w-full bg-cyan-50 dark:bg-slate-800 block rounded-2xl"
                  layoutId="hoverBackgroundDifferentiator"
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
            <div className="relative z-20 p-6 lg:p-8 rounded-2xl border border-border bg-white dark:bg-slate-900 group-hover:border-cyan-300 dark:group-hover:border-cyan-500 group-hover:shadow-xl transition-all duration-300 h-full">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{differentiator.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {differentiator.description}
              </p>
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wide">
                  {differentiator.highlight}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function WhyDifferent() {
  return (
    <section className="relative py-16 lg:py-20 bg-gradient-to-b from-background via-slate-50 to-background overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-cyan-500/8 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/8 rounded-full blur-3xl"></div>
        {/* Dot pattern overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(6,182,212,0.15)_1px,transparent_0)] bg-[length:32px_32px] opacity-30"></div>
      </div>
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <MotionDiv
          className="text-center mb-12 space-y-4"
          {...defaultAnimationOptions}
          variants={fadeInUp}
        >
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground">
            Why EvidentlyAEO Is Different
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Most AEO tools stop at visibility reports. We're the only full-loop Answer Engine Optimization system that goes from measurement to measurable business outcomes.
          </p>
        </MotionDiv>

        <div className="relative">
          <DifferentiatorCardGrid differentiators={differentiators} />
        </div>
      </div>
    </section>
  )
}
