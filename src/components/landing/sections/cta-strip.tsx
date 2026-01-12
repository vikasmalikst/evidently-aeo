"use client"
import { useState } from "react"
import { Link } from 'react-router-dom';
import { Button } from "@/components/landing/ui/button"
import { ArrowRight } from "lucide-react"
import { MotionDiv, fadeInUp, defaultAnimationOptions } from "@/lib-landing/animations"
import { BookDemoModal } from "@/components/landing/book-demo-modal"

export function CTAStrip() {
  const [showDemoModal, setShowDemoModal] = useState(false)

  return (
    <section className="py-12 lg:py-16 bg-gradient-to-r from-cyan-500 to-blue-600 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <MotionDiv
          className="text-center space-y-6"
          {...defaultAnimationOptions}
          variants={fadeInUp}
        >
          <div className="space-y-3">
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-white">
              Ready to turn AI visibility into measurable outcomes?
            </h2>
            <p className="text-lg text-cyan-50">Start free. No credit card required. All features included.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link to="https://app.evidentlyaeo.com/auth">
              <Button
                size="lg"
                className="bg-white text-cyan-600 hover:bg-cyan-50 hover:scale-105 transition-transform shadow-xl gap-2 group"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setShowDemoModal(true)}
              className="border-2 border-white text-white hover:bg-white/10 hover:scale-105 transition-transform gap-2 group bg-transparent"
            >
              Book a Demo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </MotionDiv>
      </div>

      <BookDemoModal open={showDemoModal} onOpenChange={setShowDemoModal} />
    </section>
  )
}
