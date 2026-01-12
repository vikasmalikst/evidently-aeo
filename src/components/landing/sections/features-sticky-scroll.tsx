"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useInView } from "framer-motion"
import { cn } from "@/lib-landing/utils"
import { 
  BarChart3, 
  Zap, 
  Target, 
  CheckCircle2,
  LayoutDashboard,
  LucideIcon
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
  
  return (
    <div id="platform" className="bg-background relative w-full pt-20 pb-40">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-24 relative">
          
          {/* Left Side: Scrollable Text (NARROWER) */}
          <div className="w-full lg:w-5/12 flex flex-col pt-[10vh]">
             {features.map((feature, index) => (
                <FeatureTextBlock 
                  key={index} 
                  feature={feature} 
                  index={index}
                  setActiveCard={setActiveCard}
                />
             ))}
          </div>

          {/* Right Side: Sticky Image Area (WIDER) */}
          <div className="hidden lg:block w-full lg:w-7/12 relative">
             <div className="sticky top-[20vh] h-[500px] w-full rounded-3xl overflow-hidden shadow-2xl border border-border bg-background">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: activeCard === index ? 1 : 0,
                      scale: activeCard === index ? 1 : 1.05, // Subtle zoom out when fading out
                      filter: activeCard === index ? "blur(0px)" : "blur(4px)" // Blur effect
                    }}
                    transition={{ duration: 0.7, ease: "easeInOut" }}
                    className="absolute inset-0 w-full h-full"
                  >
                     {/* Image without colored overlay */}
                     <img 
                        src={feature.image} 
                        alt={feature.title}
                        className="w-full h-full object-contain object-left-top"
                     />
                     
                     {/* Subtle gradient at bottom for depth */}
                     <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
                  </motion.div>
                ))}
             </div>
          </div>

        </div>
      </div>
    </div>
  )
}

interface FeatureTextBlockProps {
  feature: Feature
  index: number
  setActiveCard: (i: number) => void
}

function FeatureTextBlock({ feature, index, setActiveCard }: FeatureTextBlockProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Trigger when the element is well within the center of the viewport
  const isInView = useInView(ref, { margin: "-50% 0px -50% 0px" })

  useEffect(() => {
    if (isInView) {
      setActiveCard(index)
    }
  }, [isInView, index, setActiveCard])

  const Icon = feature.icon

  return (
    <div 
      ref={ref}
      className="flex flex-col justify-center min-h-[80vh] py-20" 
    >
      <div className="flex flex-col gap-6 max-w-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
             <Icon className="w-6 h-6 text-black dark:text-white" />
          </div>
          <span className="text-sm font-bold tracking-widest text-muted-foreground uppercase">
            {feature.title}
          </span>
        </div>
        
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
          {feature.heading}
        </h2>
        
        <p className="text-xl text-muted-foreground leading-relaxed">
          {feature.description}
        </p>

        <ul className="space-y-4 mt-4">
          {feature.highlights.map((item: string, i: number) => (
            <li key={i} className="flex items-start gap-4 group">
              <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-foreground transition-all group-hover:scale-150 group-hover:bg-blue-600" />
              <span className="text-lg font-medium text-foreground/80">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}


