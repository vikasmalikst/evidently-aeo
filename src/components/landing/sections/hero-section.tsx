"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/landing/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { BookDemoModal } from "@/components/landing/book-demo-modal"
import { HeroBackground } from "@/components/landing/hero-background"
import { Link } from "react-router-dom"

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const taglines = [
  "First Choice",
  "Trusted Answer",
  "Source of Truth"
]

export function HeroSection() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const MotionDiv = motion.div

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % taglines.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="relative pt-32 pb-40 lg:pt-48 lg:pb-48 overflow-hidden flex flex-col items-center justify-center min-h-[90vh]">
      <HeroBackground />

      {/* Ambient Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-cyan-400/10 blur-[100px] rounded-full pointer-events-none z-0 mix-blend-screen" />

      <div className="container mx-auto px-4 lg:px-6 relative z-10 text-center">
        <MotionDiv
          className="max-w-4xl mx-auto space-y-8"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.2,
              },
            },
          }}
        >
          <MotionDiv className="space-y-6" variants={fadeInUp} transition={{ duration: 0.6 }}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-foreground leading-[1.1] md:leading-[1.05]">
              Become the AI's <br className="hidden md:block" />
              <span className="block h-[1.2em] overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={index}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -40, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 animate-gradient-x py-1"
                  >
                    {taglines[index]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
              AI search is quietly erasing your organic traffic. CMOs and SEO leaders use EvidentlyAEO to measure, optimize, and reclaim visibility in ChatGPT, Gemini, and beyond.
            </p>
            <p className="text-sm font-medium text-cyan-600 uppercase tracking-widest pt-2">
              For CMOs • VPs of Marketing • SEO Leaders
            </p>
          </MotionDiv>

          {/* CTAs */}
          <MotionDiv
            className="flex flex-col sm:flex-row gap-5 justify-center items-center pt-4"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link 
             to="/auth" >
            <Button
              size="lg"
              className="rounded-full px-10 py-7 text-lg bg-cyan-500 text-white hover:bg-cyan-600 transition-all hover:scale-105 shadow-[0_0_40px_-10px_rgba(6,182,212,0.5)] border border-cyan-400/20"
            >
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-10 py-7 text-lg border-2 hover:bg-muted/50 transition-all hover:scale-105 bg-background/50 backdrop-blur-sm"
              onClick={() => setIsDemoModalOpen(true)}
            >
              Book a Demo
            </Button>
          </MotionDiv>

          <MotionDiv
            className="flex flex-col items-center gap-3 text-sm text-muted-foreground pt-8 opacity-80"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <p className="font-medium tracking-wide">Built for forward-thinking marketing teams ready to own the AI search era</p>
          </MotionDiv>
        </MotionDiv>
      </div>

      <BookDemoModal open={isDemoModalOpen} onOpenChange={setIsDemoModalOpen} />
    </section>
  )
}
