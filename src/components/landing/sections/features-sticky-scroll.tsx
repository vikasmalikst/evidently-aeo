"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useInView, useScroll, useTransform, useMotionValueEvent } from "framer-motion"
import { cn } from "@/lib-landing/utils"
import {
  BarChart3,
  Zap,
  LayoutDashboard,
  LucideIcon,
  Check
} from "lucide-react"

interface Feature {
  icon: LucideIcon
  title: string
  heading: string
  description: string
  highlights: string[]
  image: string
  color: string
}

const features: Feature[] = [
  {
    icon: LayoutDashboard,
    title: "Command Center",
    heading: "Your entire AEO landscape, visualized instantly.",
    description: "Stop guessing. See your brand's performance across ChatGPT, Gemini, Perplexity, and more in one unified executive dashboard. Turn scattered signals into strategy.",
    highlights: [
      "Holistic visibility across every major AI engine.",
      "Real-time sentiment and citation tracking.",
      "Instant performance snapshots for stakeholders.",
      "Track growth trends and optimization impact."
    ],
    image: "/DashboardLatest.jpeg",
    color: "from-cyan-500 to-blue-600"
  },
  {
    icon: BarChart3,
    title: "Competitive Intelligence",
    heading: "Know exactly how you stack up against competitors.",
    description: "Compare your brand's AI visibility side-by-side with competitors. See visibility scores, share of answers, sentiment, and brand presence—all in one view.",
    highlights: [
      "Side-by-side competitive comparison of Visibility & Sentiment.",
      "Goal-adaptive benchmarking for dynamic campaigns.",
      "Track competitive trends over time.",
      "Benchmark across ChatGPT, Perplexity, Gemini, and more."
    ],
    image: "/CompetitiveLatest.jpeg",
    color: "from-blue-500 to-cyan-500"
  },
  {
    icon: Zap,
    title: "Smart Recommendations",
    heading: "Get AI-specific optimization recommendations.",
    description: "Not generic SEO advice. Get Source specific guidance. Fix topical authority and become the definitive source.",
    highlights: [
      "Source specific guidance.",
      "Entity-based insights to fix topical authority.",
      "AI-assisted support for Q&A and structured data.",
      "Execution playbooks for marketing and content teams."
    ],
    image: "/RecommendationsLatest.jpeg",
    color: "from-purple-500 to-pink-500"
  }
]

export function FeaturesStickyScroll() {
  const [activeCard, setActiveCard] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  })

  return (
    <div 
      id="platform" 
      ref={containerRef}
      className="bg-slate-50 relative w-full pt-10 pb-40 dark:bg-black"
    >
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 relative">

          {/* Left Side: Scrollable Text (NARROWER) */}
          <div className="w-full lg:w-5/12 flex flex-col pt-[5vh]">
            {features.map((feature, index) => (
              <FeatureTextBlock
                key={index}
                feature={feature}
                index={index}
                setActiveCard={setActiveCard}
                activeCard={activeCard}
              />
            ))}
          </div>

          {/* Right Side: Sticky Image Area (WIDER) */}
          <div className="hidden lg:block w-full lg:w-7/12 relative">
            <div className="sticky top-[20vh] h-[500px] w-full">
              <div className="relative w-full h-full perspective-1000">
                {features.map((feature, index) => (
                  <FeatureCard 
                     key={index} 
                     feature={feature} 
                     index={index} 
                     activeCard={activeCard} 
                  />
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function FeatureCard({ feature, index, activeCard }: { feature: Feature, index: number, activeCard: number }) {
   const isActive = activeCard === index
   const isPast = activeCard > index
   
   return (
      <motion.div
        className="absolute inset-0 w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-border bg-white dark:bg-slate-900"
        initial={{ opacity: 0, y: 100, scale: 0.9, rotateX: -10 }}
        animate={{
          opacity: isActive ? 1 : (isPast ? 0 : 0),
          y: isActive ? 0 : (isPast ? -50 : 100), // Slide up when active, slide further up when past
          scale: isActive ? 1 : (isPast ? 0.95 : 0.9), // Scale down when moving to background
          rotateX: isActive ? 0 : (isPast ? 5 : -10),
          zIndex: isActive ? 10 : (isPast ? 0 : 20 - index)
        }}
        transition={{ 
           duration: 0.7, 
           type: "spring",
           stiffness: 100,
           damping: 20
        }}
      >
        {/* Browser Top Bar Decoration */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-slate-100 dark:bg-slate-800 border-b border-border flex items-center px-4 gap-2 z-10">
           <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
           <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
           <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
           <div className="ml-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 w-1/3" />
        </div>

        {/* Image Container */}
        <div className="absolute inset-0 top-8 bg-slate-50 dark:bg-slate-950">
           <motion.img
            src={feature.image}
            alt={feature.title}
            className="w-full h-full object-cover object-left-top"
            initial={{ scale: 1.1 }}
            animate={{ scale: isActive ? 1 : 1.1 }}
            transition={{ duration: 0.8 }}
            loading="lazy"
          />
          
          {/* Active Overlay Gradient */}
          <div className={cn(
             "absolute inset-0 bg-gradient-to-t from-background/20 to-transparent opacity-0 transition-opacity duration-500",
             isActive ? "opacity-100" : "opacity-0"
          )} />
        </div>
      </motion.div>
   )
}


interface FeatureTextBlockProps {
  feature: Feature
  index: number
  activeCard: number
  setActiveCard: (i: number) => void
}

function FeatureTextBlock({ feature, index, activeCard, setActiveCard }: FeatureTextBlockProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { margin: "-50% 0px -50% 0px" })
  const isActive = activeCard === index

  useEffect(() => {
    if (isInView) {
      setActiveCard(index)
    }
  }, [isInView, index, setActiveCard])

  const Icon = feature.icon

  return (
    <div
      ref={ref}
      className={cn(
         "flex flex-col justify-center min-h-[80vh] py-20 pl-8 border-l-2 transition-all duration-500",
         isActive ? "border-cyan-500" : "border-slate-200 dark:border-slate-800"
      )}
    >
      <div className="flex flex-col gap-6 max-w-xl">
        <motion.div 
           className="flex items-center gap-3"
           initial={{ opacity: 0, x: -20 }}
           whileInView={{ opacity: 1, x: 0 }}
           viewport={{ once: true }}
           transition={{ delay: 0.2 }}
        >
          <div className={cn(
             "p-2 rounded-lg transition-colors duration-500",
             isActive ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
          )}>
            <Icon className="w-6 h-6" />
          </div>
          <span className={cn(
             "text-sm font-bold tracking-widest uppercase transition-colors duration-500",
             isActive ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground"
          )}>
            {feature.title}
          </span>
        </motion.div>

        <motion.h2 
           className="text-4xl md:text-5xl font-bold tracking-tight text-foreground"
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           transition={{ delay: 0.3 }}
        >
          {feature.heading}
        </motion.h2>

        <motion.p 
           className="text-xl text-muted-foreground leading-relaxed"
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           transition={{ delay: 0.4 }}
        >
          {feature.description}
        </motion.p>

        <ul className="space-y-5 mt-4">
          {feature.highlights.map((item: string, i: number) => (
            <motion.li 
               key={i} 
               className="flex items-start gap-4 group"
               initial={{ opacity: 0, x: -10 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               transition={{ delay: 0.5 + (i * 0.1) }}
            >
              <div className={cn(
                 "mt-1 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300",
                 isActive ? "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40" : "bg-slate-100 text-slate-400"
              )}>
                 <Check className="w-3 h-3" strokeWidth={3} />
              </div>
              <span className="text-lg font-medium text-foreground/80">{item}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  )
}
