"use client"

import { motion, useAnimation, useInView } from "framer-motion"
import {
  BarChart2,
  BrainCircuit,
  Telescope,
  ClipboardCheck,
  Rocket,
  LineChart
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib-landing/utils"

const steps = [
  {
    id: "measure",
    title: "1. Measure",
    icon: BarChart2,
    description: "Benchmark vs. competitors.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "group-hover:border-blue-500/50"
  },
  {
    id: "analyze",
    title: "2. Analyze",
    icon: BrainCircuit,
    description: "Deep insights & takeaways.",
     color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    border: "group-hover:border-cyan-500/50"
  },
  {
    id: "discover",
    title: "3. Discover",
    icon: Telescope,
    description: "Find LLM traffic opportunities.",
    color: "text-teal-500",
    bg: "bg-teal-500/10",
    border: "group-hover:border-teal-500/50"
  },
  {
    id: "action",
    title: "4. Plan",
    icon: ClipboardCheck,
    description: "Build your action strategy.",
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "group-hover:border-green-500/50"
  },
  {
    id: "execute",
    title: "5. Execute",
    icon: Rocket,
    description: "Generate content & results.",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    border: "group-hover:border-yellow-500/50"
  },
  {
    id: "impact",
    title: "6. Impact",
    icon: LineChart,
    description: "Track ROI & AEO value.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "group-hover:border-purple-500/50"
  }
]

export function FullLoopStrip() {
  const radius = 220 
  const stepAngle = 360 / steps.length
  
  // State for interactivity
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)

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
    <section className="py-24 bg-slate-50/50 dark:bg-black/20 border-y border-border/50 relative overflow-hidden">
      {/* Background ambient glow - reduced size for tighter feel */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Mesh grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400">
              The AEO Loop
            </h2>
            <p className="text-lg text-muted-foreground w-full max-w-xl mx-auto mb-4 leading-relaxed">
              We don't just show you data. We provide the <span className="font-semibold text-foreground">only complete system</span> connecting visibility to verifiable revenue outcomes.
            </p>
          </motion.div>
        </div>

        {/* --- DESKTOP: CIRCULAR LAYOUT --- */}
        <div className="hidden xl:flex relative h-[650px] items-center justify-center -mt-10">
          
          {/* SVG Container for Beams */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 800 800">
             <defs>
               <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                 <feGaussianBlur stdDeviation="4" result="blur" />
                 <feComposite in="SourceGraphic" in2="blur" operator="over" />
               </filter>
               <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                 <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
                 <stop offset="50%" stopColor="#06b6d4" stopOpacity="1" />
                 <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
               </linearGradient>
                <linearGradient id="active-beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                 <stop offset="0%" stopColor="#ec4899" stopOpacity="0" />
                 <stop offset="50%" stopColor="#a855f7" stopOpacity="1" />
                 <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
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
                
                {/* Standard Animated Beam */}
                <motion.path
                  d={generateArcPath(index)}
                  fill="none"
                  stroke="url(#beam-gradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ 
                    pathLength: [0, 0.4, 0],
                    opacity: [0, 0.8, 0],
                    pathOffset: [0, 0.6, 1]
                  }}
                  transition={{ 
                    duration: 3, 
                    ease: "linear",
                    repeat: Infinity,
                    repeatDelay: 0,
                    delay: index * 0.5 
                  }}
                />
                
                {/* Hover Activated Beam - High Speed */}
                {hoveredStep === index && (
                   <motion.path
                    d={generateArcPath(index)}
                    fill="none"
                    stroke="url(#active-beam-gradient)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    filter="url(#glow)"
                    initial={{ pathLength: 0.2, opacity: 0, pathOffset: 0 }}
                    animate={{ 
                      opacity: [0, 1, 0],
                      pathOffset: [0, 1]
                    }}
                    transition={{ 
                      duration: 0.8, 
                      ease: "linear",
                      repeat: Infinity
                    }}
                  />
                )}
              </g>
            ))}
          </svg>

          {/* Central 'Engine' Node - Interactive */}
          <motion.div 
            className="absolute z-20 flex flex-col items-center justify-center w-48 h-48 rounded-full bg-white/10 dark:bg-black/40 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_0_50px_-10px_rgba(6,182,212,0.3)]"
            animate={{ 
              scale: hoveredStep !== null ? 1.05 : 1,
              borderColor: hoveredStep !== null ? "rgba(168, 85, 247, 0.3)" : "rgba(255, 255, 255, 0.2)",
              boxShadow: hoveredStep !== null 
                ? "0 0 60px -10px rgba(168, 85, 247, 0.4)" 
                : "0 0 50px -10px rgba(6,182,212,0.3)" 
            }}
            transition={{ duration: 0.4 }}
          >
            <div className="relative">
              {/* Inner pulsing core */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 blur-xl opacity-40 animate-pulse" />
              
              <motion.div 
                className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg relative z-10 overflow-hidden"
                animate={{
                  background: hoveredStep !== null 
                    ? "linear-gradient(to top right, #9333ea, #3b82f6)" 
                    : "linear-gradient(to top right, #06b6d4, #2563eb)"
                }}
              >
                 {/* Shine effect */}
                 <motion.div 
                    className="absolute inset-0 bg-white/30 skew-x-12"
                    animate={{ x: ["-150%", "150%"] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                 />
                <span className="text-3xl font-bold font-serif italic text-white">E</span>
              </motion.div>
            </div>
            
            <div className="mt-3 text-center">
              <p className="font-bold text-foreground text-base tracking-tight leading-none">Evidently</p>
              <motion.p 
                className="font-bold text-sm tracking-widest uppercase mt-1"
                animate={{ color: hoveredStep !== null ? "#a855f7" : "#0891b2" }}
              >
                Engine
              </motion.p>
            </div>
          </motion.div>

          {/* Orbiting Steps */}
          {steps.map((step, index) => {
            const angle = (index * (360 / steps.length)) - 90
            const radian = (angle * Math.PI) / 180
            const x = radius * Math.cos(radian)
            const y = radius * Math.sin(radian)
            const isHovered = hoveredStep === index

            return (
              <motion.div
                key={step.id}
                className="absolute w-[280px]"
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
                onMouseEnter={() => setHoveredStep(index)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                <motion.div 
                  className={cn(
                    "group relative bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl p-5 border cursor-pointer overflow-hidden transition-all duration-300",
                     isHovered 
                        ? "border-cyan-400/50 dark:border-cyan-500/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] scale-105" 
                        : "border-slate-200/60 dark:border-slate-800 shadow-sm"
                  )}
                >
                  {/* Shimmer Effect on Hover */}
                  <div className="absolute inset-0 -translate-x-[100%] group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent z-0 pointer-events-none" />

                  <div className="flex items-center gap-4 relative z-10">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center transition-all duration-300",
                      isHovered ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 scale-110" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    )}>
                      <step.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className={cn(
                        "font-bold text-lg mb-1 transition-colors duration-300",
                        isHovered ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600" : "text-slate-900 dark:text-slate-100"
                      )}>
                        {step.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-snug font-medium">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )
          })}
        </div>

        {/* --- MOBILE/TABLET: IMPROVED TIMELINE LAYOUT --- */}
        <div className="flex xl:hidden flex-col gap-0 max-w-md mx-auto relative pt-8 pb-8">
          {/* Animated Connecting Line */}
          <div className="absolute left-[30px] top-10 bottom-10 w-0.5 bg-slate-200 dark:bg-slate-800">
             <motion.div 
              className="w-full bg-gradient-to-b from-cyan-400 to-blue-600 origin-top"
              initial={{ height: "0%" }}
              whileInView={{ height: "100%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
             />
          </div>

          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20, y: 20 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className="relative pl-20 py-4 group"
            >
              <div className="absolute left-[8px] top-6 w-11 h-11 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 border-4 border-slate-50 dark:border-black shadow-sm z-20 group-hover:scale-110 transition-transform duration-300">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <step.icon className="w-5 h-5 text-slate-500 group-hover:text-white relative z-10 transition-colors duration-300" />
              </div>

              <div className="bg-white dark:bg-slate-900/40 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm group-hover:shadow-lg group-hover:border-cyan-500/30 transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                   <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 transition-colors">{step.title}</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
