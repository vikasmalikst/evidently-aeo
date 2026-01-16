"use client"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/landing/ui/accordion"
import { MotionDiv, fadeInUp, defaultAnimationOptions } from "@/lib-landing/animations"

const faqs = [
  {
    category: "Product & Platform",
    question: "What's the difference between AEO (Answer Engine Optimization) and traditional SEO?",
    answer:
      "SEO optimizes for click-through rates in search engine results pages (SERPs). AEO optimizes for citations and mentions in AI-generated answers (zero-click results). With Google AI Overviews, ChatGPT, Perplexity, and Gemini now providing direct answers, being cited in those answers is more valuable than ranking #1 in organic search. AI visibility is your new competitive advantage.",
  },
  {
    category: "Product & Platform",
    question: "Which AI platforms do you track?",
    answer:
      "We monitor Google AI Overviews (SGE), ChatGPT, Perplexity, Google Gemini, and Claude (Anthropic). We're continuously adding emerging platforms like OpenAI's new reasoning models and other AI systems as they gain market share.",
  },
  {
    category: "Product & Platform",
    question: "How often is your data updated? Is it real-time?",
    answer:
      "Data is collected in real-time, with hourly aggregation to our database. Dashboards update every hour, 24/7. We run 100s of queries daily across all platforms to ensure statistical significance—not just spot checks.",
  },
  {
    category: "Competitive Intelligence",
    question: "Can I track competitors and see how they're positioned?",
    answer:
      "Yes. Every dashboard includes competitive benchmarking. See your Share of Answer vs. top 5 competitors, understand their positioning, and identify gaps in their coverage.",
  },
  {
    category: "Competitive Intelligence",
    question: "How do you calculate Share of Answer?",
    answer:
      "Share of Answer measures what percentage of AI mentions in your category belong to your brand vs. competitors. We analyze thousands of queries daily across all tracked platforms to ensure statistical significance. For example, if your brand appears in 60% of AI answers for your category and your top competitor appears in 30%, your Share of Answer is 60%.",
  },
  {
    category: "Implementation & Onboarding",
    question: "How long does setup take?",
    answer:
      "Setup takes less than 5 minutes. Add your brand name, industry, and up to 5 competitors. We'll start tracking immediately and you'll see your first results within 24 hours. No technical resources or coding required.",
  },
  {
    category: "Implementation & Onboarding",
    question: "Do I need technical resources to use EvidentlyAEO?",
    answer:
      "No. EvidentlyAEO is designed for marketing teams. No coding, no technical setup. Our recommendations are actionable—you can implement them with your existing content team. Everything is accessible through our web dashboard.",
  },
  {
    category: "Pricing & Plans",
    question: "What's included in the free trial?",
    answer:
      "The 14-day free trial includes full access to all features: real-time visibility tracking, competitive benchmarking, AI-specific recommendations, and ROI reporting. No credit card required. You can cancel anytime during the trial.",
  },
  {
    category: "Pricing & Plans",
    question: "Can I change plans later?",
    answer:
      "Yes, you can upgrade, downgrade, or cancel anytime. Changes take effect immediately. No long-term contracts or hidden fees. If you upgrade mid-month, we'll prorate the difference. If you downgrade, the new plan starts at your next billing cycle.",
  },
  {
    category: "Data & Security",
    question: "How do you ensure data accuracy?",
    answer:
      "We query AI models directly using real user queries—no simulations or estimates. Every data point reflects an actual AI response. We run 100s of queries daily per brand to ensure statistical significance. Our methodology is transparent: we show you exactly which queries we run and when.",
  },
  {
    category: "Product & Platform",
    question: "What makes EvidentlyAEO different from other AEO tools?",
    answer:
      "Most AEO tools stop at visibility reports. EvidentlyAEO is the only full-loop Answer Engine Optimization system that goes from measurement to measurable business outcomes. We bake in workflows (Discover Opportunities → To-Do List → Review and Refine → Track Outcomes) to ensure changes actually ship. We also offer optional professional services and tie success to AEO outcomes—visibility lift, share-of-answers gains, sentiment improvement—not seat-based or login-based pricing.",
  },
  {
    category: "Implementation & Onboarding",
    question: "Do you offer professional services or implementation support?",
    answer:
      "Yes. EvidentlyAEO offers an optional services layer including strategy facilitation, narrative design, program management, content generation, and implementation support. Success is tied to AEO outcomes—visibility lift, share-of-answers gains, sentiment improvement—not seat licenses. This Outcome-as-a-Service approach ensures you get results, not just access to a dashboard.",
  },
  {
    category: "Product & Platform",
    question: "How do you define success? Is it just dashboard usage?",
    answer:
      "Success is defined by AEO outcomes—visibility lift, share-of-answers gains, sentiment improvement. We're not a dashboard company focused on logins or seat counts. Our dashboards serve decisions, workflows, and accountability. Our goal is to help you own answers for 3-5 strategic themes in 6-12 months, with success measured by measurable business outcomes, not tool usage.",
  },
]

export function FAQSection() {
  return (
    <section id="faq" className="relative py-16 lg:py-20 bg-gradient-to-b from-background via-white to-slate-50/30 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/6 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-blue-500/6 rounded-full blur-3xl"></div>
      </div>
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="max-w-3xl mx-auto">
          <MotionDiv
            className="text-center mb-12 space-y-4"
            {...defaultAnimationOptions}
            variants={fadeInUp}
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">Frequently Asked Questions</h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to know about Answer Engine Optimization with EvidentlyAEO
            </p>
          </MotionDiv>

          <MotionDiv {...defaultAnimationOptions} variants={fadeInUp}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border border-border rounded-lg px-6 data-[state=open]:bg-white data-[state=open]:shadow-md transition-all hover:border-cyan-500/50"
                >
                  <AccordionTrigger className="text-base font-semibold text-foreground hover:text-cyan-600 py-4 text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </MotionDiv>

          <MotionDiv
            className="mt-12 text-center"
            {...defaultAnimationOptions}
            variants={fadeInUp}
            transition={{ delay: 0.2 }}
          >
            <p className="text-sm text-muted-foreground">
              Still have questions?{" "}
              <a href="#" className="text-cyan-600 hover:underline font-medium">
                Contact our team →
              </a>
            </p>
          </MotionDiv>
        </div>
      </div>
    </section>
  )
}
