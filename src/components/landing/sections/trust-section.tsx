"use client"

import { Card } from "@/components/landing/ui/card"
import { MotionDiv, fadeInUp, staggerContainer, defaultAnimationOptions } from "@/lib-landing/animations"

export function TrustSection() {
  return (
    <section className="relative py-20 lg:py-28 bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-cyan-400/10 via-blue-500/5 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-blue-400/10 via-cyan-500/5 to-transparent rounded-full blur-3xl"></div>
      </div>
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <MotionDiv
          className="max-w-4xl mx-auto"
          {...defaultAnimationOptions}
          variants={staggerContainer}
        >
          {/* Section Header */}
          <MotionDiv className="text-center mb-12" variants={fadeInUp}>
            <h3 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Why Teams Trust EvidentlyAEO</h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Real data. Real insights. No simulations or guesswork.
            </p>
          </MotionDiv>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Data Integrity Callout */}
            <MotionDiv variants={fadeInUp}>
              <Card className="p-8 h-full border-cyan-500/30 bg-gradient-to-br from-cyan-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-cyan-500 hover:shadow-lg transition-shadow">
                <p className="text-lg font-bold text-foreground mb-3">Real AI Queries. Real Results.</p>
                <p className="text-muted-foreground leading-relaxed">
                  EvidentlyAEO queries AI models directly—no simulations, no estimates. Every data point reflects a real AI
                  response from real queries run against ChatGPT, Gemini, Perplexity, and more.
                </p>
              </Card>
            </MotionDiv>

            {/* Outcome Focus Callout */}
            <MotionDiv variants={fadeInUp}>
              <Card className="p-8 h-full border-purple-500/30 bg-gradient-to-br from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
                <p className="text-lg font-bold text-foreground mb-3">Outcomes, Not Just Dashboards</p>
                <p className="text-muted-foreground leading-relaxed">
                  We tie success to improved share of answers, visibility lift, and sentiment improvement. Optional professional services ensure recommendations actually ship.
                </p>
              </Card>
            </MotionDiv>
          </div>

          {/* Testimonial */}
          <MotionDiv className="mt-12" variants={fadeInUp}>
            <Card className="p-8 bg-white dark:bg-slate-800 border-border hover:shadow-lg transition-shadow text-center">
              <div className="space-y-4">
                <div className="flex gap-1 justify-center">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-400 text-xl">
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-lg italic text-foreground leading-relaxed max-w-2xl mx-auto">
                  "EvidentlyAEO gave us visibility into where we actually appear in AI answers. Within weeks, we had a
                  clear roadmap for improving our presence. It's the insight we didn't know we were missing."
                </p>
                <div className="pt-2">
                  <p className="text-sm font-semibold text-foreground">VP of Marketing</p>
                  <p className="text-xs text-muted-foreground">Enterprise SaaS Company</p>
                </div>
              </div>
            </Card>
          </MotionDiv>
        </MotionDiv>
      </div>
    </section>
  )
}
