"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Minus, MessageCircle, ArrowRight, Search } from "lucide-react"
import { Button } from "@/components/landing/ui/button"
import { cn } from "@/lib-landing/utils"

const categories = ["General", "Product", "Comparison", "Support"] as const
type Category = typeof categories[number]

const faqs = [
  // General
  {
    category: "General",
    question: "What is Answer Engine Optimization (AEO)?",
    answer: "AEO is the process of optimizing your brand's content to be cited as the definitive answer by AI models like ChatGPT, Gemini, and Perplexity. Unlike SEO which targets blue links, AEO targets the direct answer.",
  },
  {
    category: "General",
    question: "How is AEO different from SEO?",
    answer: "SEO focuses on ranking links on a search page. AEO focuses on training the AI to understand your entity, ensuring your brand is the generated answer. EvidentlyAEO helps you measure and improve this 'Share of Answer'.",
  },
  
  // Product
  {
    category: "Product",
    question: "How do you ensure data accuracy?",
    answer: "We don't simulate. We query the actual AI models (Live API & Real-time scraping where permitted) to get 100% authentic ground-truth data on how your brand is perceived.",
  },
  {
    category: "Product",
    question: "Can I track competitors?",
    answer: "Yes. You can benchmark your visibility, sentiment, and share of answers directly against key competitors to see exactly where you're winning or losing ground.",
  },

  // Comparison
  {
    category: "Comparison",
    question: "Why not just use ChatGPT manually?",
    answer: "Manual checks are sporadic and biased by your history. We run thousands of neutral queries at scale, track trends over time, and provide aggregated analytics that are impossible to gather manually.",
  },
  {
    category: "Comparison",
    question: "Do you support international markets?",
    answer: "Yes, we support tracking across multiple regions and languages to ensure your global AI visibility is optimized.",
  },

  // Support
  {
    category: "Support",
    question: "Do I need technical resources?",
    answer: "No. evidentlyAEO is a no-code platform. You just plug in your brand and competitors, and we start tracking. Implementation takes less than 5 minutes.",
  },
  {
    category: "Support",
    question: "Do you offer professional services?",
    answer: "Yes, our Enterprise plans include white-glove onboarding and AEO strategy consulting from our team of experts.",
  },
]

export function FAQSection() {
  const [activeCategory, setActiveCategory] = useState<Category>("General")
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  // Filter FAQs based on active category
  // If "General", we might want to show top q's or just General ones. Let's filter strict.
  // Actually, let's map "General" to the first few if unspecified, but the data has "General" tag.
  const filteredFaqs = faqs.filter(f => f.category === activeCategory)

  return (
    <section className="relative py-24 lg:py-32 bg-background overflow-hidden" id="faq">
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24">
          
          {/* Left: Heading & Categories */}
          <div className="w-full lg:w-1/3 space-y-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
                Common Questions
              </h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to know about the platform and AEO.
              </p>
            </motion.div>

            {/* Category Tabs */}
            <div className="flex flex-col gap-2">
              {categories.map((cat, idx) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat)
                    setOpenIndex(null) // Reset open accordions on switch
                  }}
                  className={cn(
                    "text-left px-5 py-3 rounded-xl transition-all duration-200 font-medium text-sm flex items-center justify-between group",
                    activeCategory === cat
                      ? "bg-slate-100 dark:bg-slate-800 text-foreground"
                      : "text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-900"
                  )}
                >
                  {cat}
                  {activeCategory === cat && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="w-1.5 h-1.5 rounded-full bg-cyan-500"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Support Box */}
            <div className="p-6 rounded-2xl bg-cyan-50 dark:bg-slate-900 border border-cyan-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <MessageCircle className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h4 className="font-bold text-foreground mb-1">Still have questions?</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Can't find the answer you're looking for? Please chat with our friendly team.
              </p>
              <Button size="sm" className="w-full bg-cyan-500 hover:bg-cyan-600 text-white gap-2">
                Get in touch <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Right: Accordion */}
          <div className="w-full lg:w-2/3">
            <motion.div
              key={activeCategory} // Reset animation on category change
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {filteredFaqs.map((faq, index) => {
                const isOpen = openIndex === index
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "group rounded-2xl border transition-all duration-300 overflow-hidden",
                      isOpen
                        ? "bg-white dark:bg-slate-900 border-cyan-500/30 ring-4 ring-cyan-500/5 shadow-lg"
                        : "bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-cyan-500/30 hover:bg-white dark:hover:bg-slate-900"
                    )}
                  >
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="w-full text-left px-6 py-5 flex items-start sm:items-center justify-between gap-4"
                    >
                      <span className={cn(
                        "text-base lg:text-lg font-semibold transition-colors",
                        isOpen ? "text-cyan-700 dark:text-cyan-400" : "text-foreground"
                      )}>
                        {faq.question}
                      </span>
                      <div className={cn(
                        "shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                        isOpen ? "bg-cyan-500 text-white rotate-180" : "bg-slate-100 dark:bg-slate-800 text-muted-foreground group-hover:bg-cyan-50 dark:group-hover:bg-slate-700"
                      )}>
                        {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                          <div className="px-6 pb-6 pt-0">
                            <p className="text-muted-foreground leading-relaxed">
                              {faq.answer}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
