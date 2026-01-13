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
    title: "1. Measure",
    icon: BarChart2,
    description: "Benchmark vs. competitors.",
  },
  {
    id: "analyze",
    title: "2. Analyze",
    icon: BrainCircuit,
    description: "Deep insights & takeaways.",
  },
  {
    id: "discover",
    title: "3. Discover",
    icon: Telescope,
    description: "Find LLM traffic opportunities.",
  },
  {
    id: "action",
    title: "4. Plan",
    icon: ClipboardCheck,
    description: "Build your action strategy.",
  },
  {
    id: "execute",
    title: "5. Execute",
    icon: Rocket,
    description: "Generate content & results.",
  },
  {
    id: "impact",
    title: "6. Impact",
    icon: LineChart,
    description: "Track ROI & AEO value.",
  }
]

export function FullLoopStrip() {
  const radius = 220 // Reduced from 280

  const stepAngle = 360 / steps.length

  const generateArcPath = (index: number) => {
    // Start angle for this segment
    const startAngle = (index * stepAngle) - 90
    const endAngle = ((index + 1) * stepAngle) - 90

    // Small gap for the nodes
    const gap = 15; 
    
    // Convert to radians
    const startRad = ((startAngle + gap) * Math.PI) / 180
    const endRad = ((endAngle - gap) * Math.PI) / 180

    const cx = 400
    const cy = 400
    const r = radius

    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)

    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  return (
    <section className="py-20 bg-gradient-to-b from-transparent to-slate-50/50 dark:to-black/20 border-y border-border/50 relative overflow-hidden">
      {/* Background ambient glow - reduced size for tighter feel */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">The AEO Loop</h2>
          <p className="text-lg text-muted-foreground w-full max-w-xl mx-auto mb-4">
            The only platform connecting visibility to measurable revenue outcomes.
          </p>
        </div>

        {/* --- DESKTOP: CIRCULAR LAYOUT --- */}
        <div className="hidden xl:flex relative h-[650px] items-center justify-center -mt-10">
          
          {/* SVG Container for Beams */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 800 800">
             <defs>
               <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                 <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
                 <stop offset="50%" stopColor="#06b6d4" stopOpacity="1" />
                 <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
               </linearGradient>
             </defs>

            {steps.map((_, index) => (
              <g key={`track-${index}`}>
                {/* Background Track */}
                <path
                  d={generateArcPath(index)}
                  fill="none"
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeWidth="2"
                />
                
                {/* Animated Beam */}
                <motion.path
                  d={generateArcPath(index)}
                  fill="none"
                  stroke="url(#beam-gradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ 
                    pathLength: [0, 0.4, 0],
                    opacity: [0, 1, 0],
                    pathOffset: [0, 0.6, 1]
                  }}
                  transition={{ 
                    duration: 2, 
                    ease: "linear",
                    repeat: Infinity,
                    repeatDelay: 0.5,
                    delay: index * 0.3 
                  }}
                />
              </g>
            ))}
          </svg>

          {/* Central 'Engine' Node - Pulsing */}
          <motion.div 
            className="absolute z-20 flex flex-col items-center justify-center w-40 h-40 rounded-full bg-background/50 backdrop-blur-xl border border-cyan-100 dark:border-cyan-900/50 shadow-2xl"
            animate={{ boxShadow: ["0 0 20px -5px rgba(6,182,212,0.3)", "0 0 40px -5px rgba(6,182,212,0.6)", "0 0 20px -5px rgba(6,182,212,0.3)"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg mb-2 text-white relative overflow-hidden">
               {/* Shine effect */}
               <motion.div 
                  className="absolute inset-0 bg-white/30 skew-x-12"
                  animate={{ x: ["-150%", "150%"] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
               />
              <span className="text-2xl font-bold font-serif italic">E</span>
            </div>
            <p className="font-bold text-foreground text-sm tracking-tight text-center leading-none">Evidently<br/><span className="text-cyan-600">Engine</span></p>
          </motion.div>

          {/* Orbiting Steps */}
          {steps.map((step, index) => {
            const angle = (index * (360 / steps.length)) - 90
            const radian = (angle * Math.PI) / 180
            const x = radius * Math.cos(radian)
            const y = radius * Math.sin(radian)

            return (
              <motion.div
                key={step.id}
                className="absolute w-[260px]"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  x: "-50%",
                  y: "-50%"
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
              >
                <motion.div 
                  className="group relative bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 cursor-pointer overflow-hidden shadow-sm"
                  whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,1)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {/* Magic Glow Border on Hover */}
                  <div className="absolute inset-0 rounded-2xl ring-2 ring-transparent group-hover:ring-cyan-500/20 group-hover:shadow-[0_0_20px_-5px_rgba(6,182,212,0.3)] transition-all duration-300" />

                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                      <step.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-1">{step.title}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug font-medium">{step.description}</p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )
          })}
        </div>

        {/* --- MOBILE/TABLET: COMPACT TIMELINE LAYOUT --- */}
        <div className="flex xl:hidden flex-col gap-6 max-w-md mx-auto relative pt-8">
          <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gradient-to-b from-cyan-500/20 via-cyan-500/20 to-transparent -z-10" />

          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative pl-16 z-10"
            >
              <div className="absolute left-0 top-1 w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 border border-cyan-100 dark:border-slate-800 shadow-sm z-20">
                <step.icon className="w-5 h-5 text-cyan-600" />
              </div>

              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{step.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
