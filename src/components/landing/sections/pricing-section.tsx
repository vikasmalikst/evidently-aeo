"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/landing/ui/button"
import { Card } from "@/components/landing/ui/card"
import { Check, Sparkles, ArrowRight } from "lucide-react"
import { cn } from "@/lib-landing/utils"
import { Link } from "react-router-dom"

const plans = [
  {
    name: "Basic",
    monthlyPrice: 99,
    yearlyPrice: 79,
    description: "For teams who want to run AEO in-house.",
    features: [
      "Track 20 prompts",
      "Access to all models (ChatGPT, Gemini, Perplexity, etc.)",
      "Real-time visibility tracking",
      "Email support",
    ],
    cta: "Start free trial",
    popular: false,
  },
  {
    name: "Pro",
    monthlyPrice: 299,
    yearlyPrice: 249,
    description: "Advanced intelligence for growing brands.",
    features: [
      "Everything in Basic, plus:",
      "Track 100 prompts",
      "10 AI-optimized articles",
      "Email and Slack Support",
      "AEO Strategy Playbook",
    ],
    cta: "Start free trial",
    popular: true,
  },
  {
    name: "Enterprise",
    monthlyPrice: 500,
    yearlyPrice: 400,
    description: "Global scale and managed execution.",
    features: [
      "Everything in Pro, plus:",
      "Track 100 prompts",
      "Custom limits",
      "White-glove onboarding",
      "SAML SSO",
      "Executive AEO Dashboard",
    ],
    cta: "Contact Us",
    popular: false,
  },
]

export function PricingSection() {
  // Removed toggle state - Showing monthly only

  return (
    <section className="relative py-24 lg:py-32 bg-background overflow-hidden" id="pricing">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-b from-cyan-500/5 to-transparent rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-t from-purple-500/5 to-transparent rounded-full blur-3xl -z-10" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      </div>

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="text-center mb-16 space-y-6">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-sm font-semibold tracking-wide uppercase"
          >
            Pricing
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground"
          >
            Outcome-Focused Pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Success tied to AEO outcomes—visibility lift, share-of-answers gains, sentiment improvement.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const isPopular = plan.popular
            const price = plan.monthlyPrice // Always monthly
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "relative group h-full flex flex-col",
                  isPopular && "md:-mt-4 md:mb-4"
                )}
              >
                {/* Popular card glow effect */}
                {isPopular && (
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-[2rem] blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
                )}

                <Card
                  className={cn(
                    "relative flex flex-col h-full rounded-3xl border transition-all duration-300 overflow-hidden",
                    isPopular
                      ? "border-cyan-500 shadow-2xl bg-white dark:bg-zinc-950 z-10"
                      : "border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-zinc-950/80 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg"
                  )}
                >
                  {/* Popular Badge */}
                  {isPopular && (
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-2.5 text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Most Popular
                    </div>
                  )}

                  <div className="p-8 flex flex-col flex-1 relative text-center items-center">
                    <div className="mb-6 relative w-full">
                      <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-sm text-muted-foreground">$</span>
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={price}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-5xl font-bold text-foreground tracking-tighter"
                          >
                            {price}
                          </motion.span>
                        </AnimatePresence>
                        <span className="text-muted-foreground font-medium">/mo</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed min-h-[40px] px-2">
                        {plan.description}
                      </p>
                    </div>

                    <div className="w-full h-px bg-slate-100 dark:bg-slate-800 mb-6" />

                    <div className="flex-1 w-full flex justify-center mb-8">
                      <ul className="space-y-3 text-left inline-block min-w-[200px]">
                        {plan.features.map((feature, idx) => {
                          const isHeader = feature.includes("Everything in")
                          return (
                            <motion.li 
                              key={idx} 
                              className={cn("flex items-start gap-3", isHeader && "mt-4")}
                              initial={{ opacity: 0, x: -10 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true }}
                              transition={{ delay: 0.3 + idx * 0.05 }}
                            >
                              {!isHeader && (
                                <div className={cn(
                                  "rounded-full p-0.5 shrink-0 mt-0.5",
                                  isPopular ? "bg-cyan-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                )}>
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                              <span className={cn(
                                "text-sm",
                                isHeader ? "text-foreground font-bold -ml-1" : "text-foreground/80 font-medium"
                              )}>
                                {feature}
                              </span>
                            </motion.li>
                          )
                        })}
                      </ul>
                    </div>

                    <Link to="/auth" className="w-full">
                      <Button
                        className={cn(
                          "w-full h-12 rounded-full text-sm font-bold transition-all shadow-sm group/btn overflow-hidden relative",
                          isPopular
                            ? "bg-cyan-500 text-white hover:bg-cyan-600 hover:shadow-lg hover:shadow-cyan-500/20"
                            : "bg-white dark:bg-zinc-900 text-foreground border-2 border-slate-200 dark:border-slate-700 hover:border-cyan-500 hover:bg-cyan-500 hover:text-white"
                        )}
                      >
                        {/* Shimmer effect for popular */}
                        {isPopular && (
                          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                        )}
                        <span className="relative flex items-center justify-center gap-2">
                          {plan.cta}
                          <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                        </span>
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>

        <motion.div 
          className="mt-16 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-sm text-muted-foreground">
            All plans include a <span className="font-semibold text-foreground">14-day free trial</span>. No credit card required.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
