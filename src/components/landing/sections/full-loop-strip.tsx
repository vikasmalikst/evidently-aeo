"use client"

import { motion } from "framer-motion"
import { Search, PenTool, Trophy } from "lucide-react"

const steps = [
  {
    id: "measure",
    title: "Measure",
    icon: Search,
    description: "Track visibility across ChatGPT, Gemini, Perplexity, Bing Copilot and Grok.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20"
  },
  {
    id: "optimize",
    title: "Optimize",
    icon: PenTool,
    description: "Generate AI-ready content that LLMs prefer to cite.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20"
  },
  {
    id: "dominate",
    title: "Dominate",
    icon: Trophy,
    description: "Win the answer and drive high-intent traffic.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20"
  }
]

export function FullLoopStrip() {
  return (
    <section className="py-24 bg-background border-y border-border/50 relative overflow-hidden">
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="text-center mb-20">
           <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">The Complete AEO Loop</h2>
           <p className="text-lg text-muted-foreground w-full max-w-2xl mx-auto">
             Stop guessing. Start dominating. The only platform that connects visibility measurement to content optimization and final ranking outcomes.
           </p>
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          
          {/* Base Connection Line (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-[2px] bg-border -z-20" />

          {/* Animated Energy Flow (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-[2px] overflow-hidden -z-10">
             <motion.div 
               className="h-full bg-gradient-to-r from-transparent via-blue-500 via-purple-500 to-transparent w-[50%] opacity-0"
               animate={{ 
                 x: ["-100%", "200%"],
                 opacity: [0, 1, 1, 0]
               }}
               transition={{ 
                 duration: 3, 
                 ease: "linear", 
                 repeat: Infinity,
                 repeatDelay: 1
               }}
             />
          </div>

          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2, duration: 0.5 }}
              className="relative group"
            >
              <div className="bg-background rounded-2xl p-8 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.2)] hover:-translate-y-2 relative z-20 h-full group">
                
                {/* Step Number Badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-background border border-border px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm z-30 group-hover:border-blue-500/50 group-hover:text-blue-600 transition-colors">
                  Step 0{index + 1}
                </div>

                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ml-auto mr-auto ${step.bg} ${step.border} border-2 group-hover:scale-110 transition-transform duration-500`}>
                  <step.icon className={`w-8 h-8 ${step.color} transition-colors`} />
                </div>
                
                <h3 className="text-2xl font-bold mb-3 text-center group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-center group-hover:text-foreground/80 transition-colors">
                  {step.description}
                </p>

                {/* Hover Glow Effect */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.color.replace('text-', 'from-')}/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
