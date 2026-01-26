"use client"
import { useState } from "react"
import { Link } from 'react-router-dom';
import { Button } from "@/components/landing/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import { BookDemoModal } from "@/components/landing/book-demo-modal"

export function CTAStrip() {
  const [showDemoModal, setShowDemoModal] = useState(false)

  return (
    <section className="relative py-16 lg:py-24 overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 animate-gradient-x" />
      
      {/* Mesh/Wave Overlay */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.2)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,rgba(255,255,255,0.15)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.1)_0%,transparent_40%)]" />
      </div>

      {/* Floating Shapes */}
      <motion.div 
        className="absolute top-10 left-[10%] w-20 h-20 bg-white/10 rounded-full blur-xl"
        animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute bottom-10 right-[15%] w-32 h-32 bg-white/10 rounded-full blur-xl"
        animate={{ y: [0, 20, 0], scale: [1, 0.9, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute top-1/2 right-[5%] w-16 h-16 bg-cyan-300/20 rounded-full blur-lg"
        animate={{ x: [0, 15, 0], y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <motion.div
          className="text-center space-y-8"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Badge */}
          <motion.div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span className="text-sm font-medium text-white">Start your free trial today</span>
          </motion.div>

          <div className="space-y-4">
            <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight">
              Ready to turn AI visibility into
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-white">
                measurable outcomes?
              </span>
            </h2>
            <p className="text-lg lg:text-xl text-white/80 max-w-2xl mx-auto">
              Start free. No credit card required. All features included.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link to="/auth">
              <Button
                size="lg"
                className="group relative bg-white text-cyan-600 hover:bg-cyan-50 transition-all shadow-2xl shadow-black/20 gap-2 px-8 py-6 text-lg font-bold rounded-full overflow-hidden"
              >
                {/* Shimmer effect */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative">Start Free Trial</span>
                <ArrowRight className="w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setShowDemoModal(true)}
              className="border-2 border-white/50 text-white hover:bg-white/10 hover:border-white transition-all gap-2 group bg-transparent px-8 py-6 text-lg font-bold rounded-full"
            >
              Book a Demo
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </motion.div>
      </div>

      <BookDemoModal open={showDemoModal} onOpenChange={setShowDemoModal} />
    </section>
  )
}
