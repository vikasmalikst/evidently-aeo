"use client"

import { motion } from "framer-motion"
import {
  BarChart2,
  BrainCircuit,
  Telescope,
  ClipboardCheck,
  Rocket,
  LineChart
} from "lucide-react"

const steps = [
  {
    id: "measure",
    title: "1. Measure & Benchmark",
    icon: BarChart2,
    description: "Your performance against top competitors.",
  },
  {
    id: "analyze",
    title: "2. Analyze Data",
    icon: BrainCircuit,
    description: "In-depth analysis for valuable insights and key takeaways.",
  },
  {
    id: "discover",
    title: "3. Discover",
    icon: Telescope,
    description: "Opportunities to optimize and improve LLM referred traffic.",
  },
  {
    id: "action",
    title: "4. Action Plan",
    icon: ClipboardCheck,
    description: "Build a comprehensive action plan.",
  },
  {
    id: "execute",
    title: "5. Execute",
    icon: Rocket,
    description: "Generate content and accelerate time to results.",
  },
  {
    id: "impact",
    title: "6. Track Impact",
    icon: LineChart,
    description: "Track ROI and the impact of your AEO strategy.",
  }
]

export function FullLoopStrip() {
  const radius = 280

  // SVG parameters for generating arcs
  // We need to draw arcs between steps.
  // Step 0 is at -90deg (top). 
  // Step i is at -90 + i * 60.
  // We want arcs between i and i+1.
  const stepAngle = 360 / steps.length

  const generateArcPath = (index: number) => {
    // Start angle for this segment (offset by -90 to start at top)
    // Add some padding so the line doesn't overlap the card
    const startAngle = (index * stepAngle) - 90 + 20
    const endAngle = ((index + 1) * stepAngle) - 90 - 20

    // Convert to radians
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    // Calculate coordinates
    // Center is 400, 400 (half of 800)
    const cx = 400
    const cy = 400
    const r = radius

    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)

    // SVG Path A command: rx ry x-axis-rotation large-arc-flag sweep-flag x y
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  return (
    <section className="py-24 bg-background border-y border-border/50 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">The Complete AEO Loop</h2>
          <p className="text-lg text-muted-foreground w-full max-w-2xl mx-auto mb-4">
            Stop guessing. Start dominating. The only platform that connects visibility measurement to content optimization and ranking outcomes.
          </p>
          <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wider">
            Outcome as a Service — We don't stop at dashboards. We deliver results.
          </p>
        </div>

        {/* --- DESKTOP: CIRCULAR LAYOUT --- */}
        <div className="hidden xl:flex relative h-[800px] items-center justify-center">

          {/* SVG Container for Arrows */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 800 800">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#06b6d4" />
              </marker>
            </defs>

            {steps.map((_, index) => (
              <motion.path
                key={`path-${index}`}
                d={generateArcPath(index)}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="opacity-40"
                markerEnd="url(#arrowhead)"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 0.4 }}
                transition={{ duration: 1, delay: index * 0.2 }}
              />
            ))}
          </svg>

          {/* Central 'Engine' Node */}
          <div className="absolute z-20 flex flex-col items-center justify-center w-48 h-48 rounded-full bg-white dark:bg-slate-900 shadow-[0_0_50px_-10px_rgba(6,182,212,0.4)] border border-cyan-100 dark:border-cyan-900/50">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg mb-2 text-white">
              <span className="text-3xl font-bold">E</span>
            </div>
            <p className="font-bold text-foreground text-lg">EvidentlyAEO</p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Engine</p>
          </div>

          {/* Orbiting Steps */}
          {steps.map((step, index) => {
            const angle = (index * (360 / steps.length)) - 90
            const radian = (angle * Math.PI) / 180
            const x = radius * Math.cos(radian)
            const y = radius * Math.sin(radian)

            return (
              <motion.div
                key={step.id}
                className="absolute w-[340px]"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  x: "-50%",
                  y: "-50%"
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
              >
                <div className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/60 dark:border-slate-800 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-cyan-500/30 hover:-translate-y-1">
                  {/* Gradient glow on hover */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 border border-cyan-100 dark:border-slate-700 shadow-sm group-hover:shadow-md transition-all">
                      <step.icon className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{step.title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{step.description}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* --- MOBILE/TABLET: TIMELINE LAYOUT --- */}
        <div className="flex xl:hidden flex-col gap-8 max-w-2xl mx-auto relative pt-8">
          {/* Vertical Line */}
          <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-cyan-500/20 via-cyan-500/20 to-transparent -z-10" />

          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative pl-20 z-10"
            >
              {/* Timeline Dot & Icon */}
              <div className="absolute left-0 top-0 w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-slate-900 border border-cyan-100 dark:border-slate-700 shadow-sm z-20">
                <step.icon className="w-5 h-5 text-cyan-600" />
              </div>

              {/* Connector line from dot to card */}
              <div className="absolute left-12 top-6 w-8 h-[1px] bg-cyan-200 dark:bg-slate-700" />

              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-slate-100">{step.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
