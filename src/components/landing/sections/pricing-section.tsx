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
  const [isAnnual, setIsAnnual] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string>("Pro")

  return (
    <section className="relative py-24 bg-background overflow-hidden" id="pricing">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-t from-purple-50/50 to-transparent dark:from-purple-900/10 rounded-full blur-3xl -z-10" />
      </div>

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="text-center mb-20 space-y-4">
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
            Success tied to AEO outcomes—visibility lift, share-of-answers gains, sentiment improvement. Start free. No credit card required.
          </motion.p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 pt-8">
            <span className={`text-sm font-semibold transition-colors ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-7 rounded-full bg-slate-200 dark:bg-slate-800 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white"
            >
              <motion.div
                className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm"
                animate={{ x: isAnnual ? 28 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold transition-colors ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
                Annual
              </span>
              <span className="text-[10px] font-bold text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30 px-2 py-0.5 rounded-full uppercase tracking-wide">
                Save 20%
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const isSelected = selectedPlan === plan.name
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative group h-full flex flex-col"
                onMouseEnter={() => setSelectedPlan(plan.name)}
              >
                <Card
                  className={cn(
                    "flex flex-col h-full rounded-[2rem] border transition-all duration-300 overflow-hidden relative",
                    isSelected
                      ? "border-cyan-500 shadow-2xl scale-105 z-10 bg-white dark:bg-zinc-950"
                      : "border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-zinc-950/50 opacity-80 hover:opacity-100 hover:bg-white dark:hover:bg-zinc-950"
                  )}
                >
                  {/* Highlight Badge */}
                  {isSelected && (
                    <div className="bg-cyan-500 text-white py-2.5 text-center text-xs font-bold uppercase tracking-widest">
                      Selected Plan
                    </div>
                  )}

                  <div className="p-8 flex flex-col flex-1 relative">
                    <div className="mb-8 relative">
                      <h3 className="text-xl font-bold text-foreground mb-4">{plan.name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl lg:text-5xl font-bold text-foreground tracking-tighter">
                          ${isAnnual ? Math.round(Number(plan.price) * 0.8) : plan.price}
                        </span>
                        <span className="text-muted-foreground font-medium">/mo</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-4 leading-relaxed min-h-[40px]">
                        {plan.description}
                      </p>
                    </div>

                    <div className="w-full h-px bg-slate-100 dark:bg-slate-800 mb-8" />

                    <ul className="space-y-4 mb-10 flex-1 relative">
                      {plan.features.map((feature, idx) => {
                        const isHeader = feature.includes("Everything in")
                        return (
                          <li key={idx} className={cn("flex items-start gap-3", isHeader && "mt-6")}>
                            {!isHeader && (
                              <div className={cn(
                                "mt-1 rounded-full p-0.5",
                                isSelected ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-500"
                              )}>
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                            <span className={cn(
                              "text-sm",
                              isHeader ? "text-foreground font-bold" : "text-foreground/80 font-medium"
                            )}>
                              {feature}
                            </span>
                          </li>
                        )
                      })}
                    </ul>

                    <Button
                      className={cn(
                        "w-full h-12 rounded-full text-sm font-bold transition-all shadow-sm",
                        isSelected
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
        <div className="mt-16 text-center">
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



