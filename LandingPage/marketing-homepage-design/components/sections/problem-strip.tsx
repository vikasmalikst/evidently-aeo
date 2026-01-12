"use client"

import { AlertCircle, TrendingDown, BarChart3 } from "lucide-react"
import { MotionDiv, fadeInUp, staggerContainer, defaultAnimationOptions } from "@/lib/animations"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"

const problems = [
  {
    icon: AlertCircle,
    title: "Your #1 rankings mean nothing if AI doesn't mention you",
    solution:
      "Most brands have zero visibility into how they appear in AI systems. You're invisible in the future of search—and losing revenue every day. Traditional SEO metrics can still look 'okay' while organic traffic and high-intent discovery quietly erode.",
  },
  {
    icon: TrendingDown,
    title: "You can't benchmark against competitors in AI search",
    solution: "See your Share of Answer vs. top 5 competitors. Understand their positioning. Fix yours before it's too late.",
  },
  {
    icon: BarChart3,
    title: "You can't optimize what you can't measure",
    solution: "Connect visibility improvements directly to qualified leads and pipeline impact. Prove ROI to your CFO with real numbers.",
  },
]

function ProblemCardGrid({ problems }: { problems: Array<{ icon: any; title: string; solution: string }> }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {problems.map((problem, index) => {
        const Icon = problem.icon
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
                  className="absolute inset-0 h-full w-full bg-white block rounded-lg"
                  layoutId="hoverBackgroundProblem"
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
            <div className="relative z-20 space-y-4 p-6 rounded-lg group-hover:shadow-md transition-all duration-300 h-full">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <Icon className="w-6 h-6 text-cyan-500" />
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold text-foreground text-base leading-snug">{problem.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{problem.solution}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ProblemStrip() {
  return (
    <section className="relative bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-y border-border py-12 lg:py-16 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(6,182,212,0.05)_25%,rgba(6,182,212,0.05)_50%,transparent_50%,transparent_75%,rgba(6,182,212,0.05)_75%,rgba(6,182,212,0.05))] bg-[length:20px_20px]"></div>
      </div>
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <ProblemCardGrid problems={problems} />
      </div>
    </section>
  )
}
