"use client"

import { Card } from "@/components/landing/ui/card"
import { Shield, Lock, CheckCircle2 } from "lucide-react"
import { MotionDiv, fadeInUp, staggerContainer, defaultAnimationOptions } from "@/lib-landing/animations"

export function TrustSection() {
  return (
    <section className="relative py-20 lg:py-28 bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-cyan-400/10 via-blue-500/5 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-blue-400/10 via-cyan-500/5 to-transparent rounded-full blur-3xl"></div>
        {/* Subtle mesh pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(6,182,212,0.1),transparent_50%)]"></div>
      </div>
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <MotionDiv
          className="grid grid-cols-1 lg:grid-cols-2 gap-12"
          {...defaultAnimationOptions}
          variants={staggerContainer}
        >
          {/* Left: Logo Wall & Testimonial */}
          <MotionDiv className="space-y-8" variants={fadeInUp}>
            <div className="space-y-4">
              <h3 className="text-2xl lg:text-3xl font-bold text-foreground">Trusted by industry leaders</h3>
              <p className="text-muted-foreground">
                Marketing and product teams at leading SaaS, E-commerce, and Enterprise companies rely on EvidentlyAEO
              </p>
            </div>

            {/* Logo Grid */}
            <div className="grid grid-cols-2 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-slate-50 hover:shadow-md transition-all duration-300 grayscale hover:grayscale-0"
                >
                  <span className="text-xs font-semibold text-muted-foreground">Brand Logo</span>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <Card className="p-6 bg-white border-border hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-400">
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-sm italic text-foreground leading-relaxed">
                  "EvidentlyAEO gave us visibility into where we actually appear in AI answers. Within weeks, we had a
                  clear roadmap and started seeing real results. The ROI is undeniable."
                </p>
                <div>
                  <p className="text-sm font-semibold text-foreground">Jane Martinez</p>
                  <p className="text-xs text-muted-foreground">VP of Marketing, Tech Company</p>
                </div>
              </div>
            </Card>
          </MotionDiv>

          {/* Right: Security & Compliance */}
          <MotionDiv className="space-y-8" variants={fadeInUp}>
            <div className="space-y-4">
              <h3 className="text-2xl lg:text-3xl font-bold text-foreground">Enterprise-grade security</h3>
              <p className="text-muted-foreground">
                Built for enterprise security requirements with compliance certifications and data protection standards
              </p>
            </div>

            {/* Compliance Cards */}
            <div className="space-y-4">
              {[
                {
                  icon: Shield,
                  title: "SOC 2 Type II",
                  desc: "Audited for security, availability, and confidentiality",
                },
                { icon: Lock, title: "GDPR Compliant", desc: "EU data protection standards and requirements" },
                { icon: CheckCircle2, title: "HIPAA-Ready", desc: "For healthcare and regulated industries" },
              ].map((item, index) => {
                const Icon = item.icon
                return (
                  <div
                    key={index}
                    className="flex gap-4 p-4 rounded-lg border border-border bg-white hover:bg-slate-50 hover:shadow-md transition-all duration-300"
                  >
                    <Icon className="w-6 h-6 text-cyan-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Data Integrity Callout */}
            <Card className="p-6 border-cyan-500/50 bg-cyan-50 border-l-4 border-l-cyan-500 hover:shadow-md transition-shadow">
              <p className="text-sm font-semibold text-foreground mb-2">Why our data is different</p>
              <p className="text-sm text-foreground leading-relaxed">
                EvidentlyAEO queries AI models directly—no simulations, no estimates. Every data point reflects a real AI
                response from real queries.
              </p>
            </Card>

            {/* Integrations */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Works with your stack</p>
              <div className="grid grid-cols-2 gap-3">
                {["Slack", "API Export", "Webhooks", "GA4"].map((int) => (
                  <div
                    key={int}
                    className="px-4 py-2 rounded-lg border border-border bg-white text-sm text-foreground font-medium flex items-center justify-center hover:bg-slate-50 hover:shadow-md transition-all duration-300"
                  >
                    {int}
                  </div>
                ))}
              </div>
            </div>
          </MotionDiv>
        </MotionDiv>
      </div>
    </section>
  )
}
