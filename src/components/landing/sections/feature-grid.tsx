"use client"

import { PieChart, Zap, Map, TrendingUp, Lightbulb, Shield } from "lucide-react"
import { MotionDiv, fadeInUp, staggerContainer, defaultAnimationOptions } from "@/lib-landing/animations"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"

const features = [
  {
    icon: PieChart,
    title: "Share of Answer Tracking",
    description:
      "Track your competitive position and prove visibility gains that drive business outcomes. See your Share of Answer vs. competitors in real-time—know exactly where you're winning and losing.",
  },
  {
    icon: Zap,
    title: "Sentiment Analysis",
    description:
      "Protect your reputation and brand perception in AI answers. Track positive, neutral, and negative tone to spot misinformation early and maintain brand trust.",
  },
  {
    icon: Map,
    title: "Query Mapping",
    description:
      "Drive visibility improvements by understanding which queries trigger your mentions. Identify high-impact topics and themes to prioritize optimization efforts.",
  },
  {
    icon: TrendingUp,
    title: "Historical Trend Reporting",
    description: "Prove ROI to leadership with visibility gains over 3–12 months. Export reports that connect AEO efforts to measurable business outcomes.",
  },
  {
    icon: Lightbulb,
    title: "AI-Specific Recommendations",
    description:
      "Turn insights into action with platform-specific optimization advice. Get actionable recommendations that move the needle—not generic SEO tips.",
  },
  {
    icon: Shield,
    title: "Competitive Benchmarking",
    description:
      "Win more share of answers by understanding competitor positioning. Identify gaps in their coverage and find opportunities to outperform them.",
  },
]

function FeatureCardGrid({ features }: { features: Array<{ icon: any; title: string; description: string }> }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {features.map((feature, index) => {
        const Icon = feature.icon
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
                  className="absolute inset-0 h-full w-full bg-cyan-50 dark:bg-slate-800/[0.8] block rounded-2xl"
                  layoutId="hoverBackground"
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
            <div className="relative z-20 p-6 lg:p-8 rounded-xl border border-border bg-white group-hover:border-cyan-300 group-hover:shadow-xl transition-all duration-300 h-full">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function FeatureGrid() {
  return (
    <section className="relative py-16 lg:py-20 bg-gradient-to-b from-slate-50 via-white to-slate-50/80 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/8 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/8 rounded-full blur-3xl"></div>
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
            Everything you need to win in AI search
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive features designed specifically for Answer Engine Optimization
          </p>
        </MotionDiv>

        <div className="relative">
          <FeatureCardGrid features={features} />
        </div>
      </div>
    </section>
  )
}
