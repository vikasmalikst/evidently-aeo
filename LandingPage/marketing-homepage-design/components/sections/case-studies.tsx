"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { MotionDiv, fadeInUp, staggerContainer, defaultAnimationOptions } from "@/lib/animations"

const caseStudies = [
  {
    industry: "SaaS / CMS Platform",
    company: "ContentStack",
    challenge: 'Lost visibility in AI "best CMS" recommendations—competitors appearing first.',
    solution:
      "Mapped high-intent queries where competitors appeared. Restructured comparison pages with schema markup and entity depth.",
    quote:
      'We went from appearing in 15% of "best CMS" answers to 67% in 8 weeks. That\'s 500+ new qualified leads per month.',
    attribution: "Sarah Chen, VP Demand Gen",
    metrics: [
      { label: "Visibility", before: "15%", after: "67%", change: "+52%" },
      { label: "Timeline", value: "8 weeks" },
      { label: "New Leads/Month", value: "500+" },
      { label: "ROI", value: "3.2x" },
    ],
  },
  {
    industry: "E-commerce / Footwear",
    company: "Athletic Brand",
    challenge: "Google Shopping Assistant recommending competitors first for price-competitive queries.",
    solution: "Enhanced product schema markup, added comparison FAQs, optimized review sentiment signals.",
    quote:
      'Google Shopping Assistant now recommends us first in "athletic shoes under $100." Our conversion rate from AI referrals is 8x higher than organic search.',
    attribution: "Marcus Rodriguez, Head of Growth",
    metrics: [
      { label: "Position", value: "#1 (60% of answers)" },
      { label: "Traffic Growth", value: "4x" },
      { label: "Conversion Rate Lift", value: "8x" },
      { label: "ROI", value: "5.5x" },
    ],
  },
]

export function CaseStudies() {
  return (
    <section className="relative py-20 lg:py-28 bg-gradient-to-b from-background via-slate-50/50 to-background overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/6 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/6 rounded-full blur-3xl"></div>
      </div>
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <MotionDiv
          className="text-center mb-16 space-y-4"
          {...defaultAnimationOptions}
          variants={fadeInUp}
        >
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground">Real results from real customers</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See how leading brands improved AI visibility and drove measurable revenue impact
          </p>
        </MotionDiv>

        <MotionDiv
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          {...defaultAnimationOptions}
          variants={staggerContainer}
        >
          {caseStudies.map((study, index) => (
            <MotionDiv key={index} variants={fadeInUp}>
              <Card className="p-8 bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full">
              <div className="space-y-6">
                {/* Header */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wide">Case Study</p>
                  <h3 className="text-xl font-bold text-foreground">{study.company}</h3>
                  <p className="text-sm text-muted-foreground">{study.industry}</p>
                </div>

                {/* Challenge & Solution */}
                <div className="space-y-3 pb-6 border-b border-border">
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Challenge</p>
                    <p className="text-sm text-muted-foreground">{study.challenge}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Solution</p>
                    <p className="text-sm text-muted-foreground">{study.solution}</p>
                  </div>
                </div>

                {/* Quote */}
                <div className="space-y-3">
                  <blockquote className="text-sm italic text-foreground leading-relaxed border-l-4 border-cyan-500 pl-4">
                    "{study.quote}"
                  </blockquote>
                  <p className="text-xs font-semibold text-muted-foreground">— {study.attribution}</p>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 pt-4">
                  {study.metrics.map((metric, idx) => (
                    <div key={idx} className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{metric.label}</p>
                      {metric.change ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-green-600">{metric.after}</span>
                          <span className="text-xs text-muted-foreground">from {metric.before}</span>
                        </div>
                      ) : (
                        <p className="text-lg font-bold text-foreground">{metric.value}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 group w-full bg-transparent hover:bg-accent hover:scale-105 transition-transform"
                  >
                    View Full Case Study
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </Card>
            </MotionDiv>
          ))}
        </MotionDiv>
      </div>
    </section>
  )
}
