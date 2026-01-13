"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/landing/ui/button"
import { Card } from "@/components/landing/ui/card"
import { Check } from "lucide-react"
import { cn } from "@/lib-landing/utils"

const plans = [
  {
    name: "Basic",
    price: 99,
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
    price: 299,
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
    price: 500,
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
  return (
    <section className="relative py-20 bg-background overflow-hidden" id="pricing">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-t from-purple-50/50 to-transparent dark:from-purple-900/10 rounded-full blur-3xl -z-10" />
      </div>

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="text-center mb-12 space-y-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground"
          >
            Outcome-Focused Pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-base text-muted-foreground max-w-2xl mx-auto"
          >
            Success tied to AEO outcomes—visibility lift, share-of-answers gains, sentiment improvement. Start free. No credit card required.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start max-w-5xl mx-auto">
          {plans.map((plan, index) => {
            const isPopular = plan.popular
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative group h-full flex flex-col"
              >
                <Card
                  className={cn(
                    "flex flex-col h-full rounded-3xl border transition-all duration-300 overflow-hidden relative",
                    isPopular
                      ? "border-cyan-500 shadow-xl scale-105 z-10 bg-white dark:bg-zinc-950"
                      : "border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-zinc-950/50 opacity-90 hover:opacity-100 hover:bg-white dark:hover:bg-zinc-950 scale-100"
                  )}
                >
                  {/* Popular Badge */}
                  {isPopular && (
                    <div className="bg-cyan-500 text-white py-2 text-center text-[10px] font-bold uppercase tracking-widest">
                      Most Popular
                    </div>
                  )}

                  <div className="p-6 flex flex-col flex-1 relative text-center items-center">
                    <div className="mb-6 relative w-full">
                      <h3 className="text-lg font-bold text-foreground mb-3">{plan.name}</h3>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold text-foreground tracking-tighter">
                          ${plan.price}
                        </span>
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
                            <li key={idx} className={cn("flex items-start gap-3", isHeader && "mt-4")}>
                              {!isHeader && (
                                <div className={cn(
                                  "rounded-full p-0.5 shrink-0 mt-0.5",
                                  isPopular ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-500"
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
                            </li>
                          )
                        })}
                      </ul>
                    </div>

                    <Button
                      className={cn(
                        "w-full h-11 rounded-full text-sm font-bold transition-all shadow-sm",
                        isPopular
                          ? "bg-cyan-500 text-white hover:bg-cyan-600 hover:shadow-lg"
                          : "bg-white text-black border-2 border-slate-200 hover:border-cyan-500 hover:bg-cyan-500 hover:text-white"
                      )}
                    >
                      {plan.cta}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Looking for enterprise capabilities?{" "}
            <a href="#" className="underline underline-offset-4 hover:text-foreground">
              Contact our sales team
            </a>{" "}
            for custom packages.
          </p>
        </div>
      </div>
    </section>
  )
}



