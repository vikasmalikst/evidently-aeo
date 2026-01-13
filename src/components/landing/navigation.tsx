"use client"

import { useState, useEffect } from "react"
import { Link } from 'react-router-dom';
import { motion } from "framer-motion";
import { Button } from "@/components/landing/ui/button"
import { Menu, X, ArrowRight } from "lucide-react"
import { cn } from "@/lib-landing/utils"
import { BookDemoModal } from "@/components/landing/book-demo-modal"

const navLinks = [
  { name: "Features", href: "#features" },
  { name: "Pricing", href: "#pricing" },
  { name: "FAQ", href: "#faq" },
]

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [showDemoModal, setShowDemoModal] = useState(false)
  // Hover state for the sliding pill animation
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <>
      {/* Floating Pill Navbar Container */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav className="pointer-events-auto flex items-center justify-between px-6 py-2 bg-slate-200/90 dark:bg-zinc-900/75 backdrop-blur-md border border-slate-300 dark:border-slate-800 rounded-full w-full max-w-5xl shadow-xl shadow-slate-300/30 dark:shadow-black/40 transition-all duration-300">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <img
              src="/evidentlyaeo-logo.png"
              alt="EvidentlyAEO Logo"
              className="h-9 w-9"
            />
            <span className="text-lg font-bold tracking-tight text-foreground">
              EvidentlyAEO
            </span>
          </Link>
          
          {/* Desktop Links (Centered relative to container) */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link, index) => (
              <Link
                key={link.name}
                to={link.href}
                className="relative text-base font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-4 py-2 rounded-full"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Animated Background Pill */}
                {hoveredIndex === index && (
                  <motion.span
                    className="absolute inset-0 bg-white/60 dark:bg-slate-800/80 rounded-full -z-10 shadow-sm"
                    layoutId="navbar-hover"
                    transition={{
                      type: "spring",
                      bounce: 0,
                      duration: 0.6
                    }}
                  />
                )}
                <span className="relative z-10">{link.name}</span>
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <Link 
              to="/auth" 
              className="text-base font-semibold text-muted-foreground hover:text-foreground transition-colors px-2"
            >
              Log in
            </Link>
            <Button 
              size="sm" 
              onClick={() => setShowDemoModal(true)}
              className="bg-cyan-500 text-white hover:bg-cyan-600 font-bold rounded-full px-6 py-2 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all hover:-translate-y-0.5 h-10 text-base"
            >
              Get a Demo
            </Button>
          </div>

          {/* Mobile Menu Button - Pushed to right */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-full text-muted-foreground hover:bg-slate-200/50 transition-colors ml-auto"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>
      </div>

       {/* Mobile Menu Overlay (Separate from pill to cover full screen/appropriate area) */}
       {isOpen && (
          <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm md:hidden pt-24 px-6 animate-in fade-in slide-in-from-top-4 duration-200">
             <div className="flex flex-col space-y-4">
              {navLinks.map((link) => (
                <Link 
                  key={link.name} 
                  to={link.href} 
                  className="flex items-center justify-between py-4 border-b border-border text-lg font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                  <ArrowRight className="w-5 h-5 opacity-50" />
                </Link>
              ))}
              <div className="pt-6 grid gap-4">
                <Link 
                    to="/auth"
                    className="flex items-center jusstify-center py-4 text-base font-semibold border rounded-xl hover:bg-accent"
                >
                    Log in
                </Link>
                <Button 
                    className="w-full bg-cyan-500 text-white rounded-xl py-6 text-base font-bold shadow-lg"
                    onClick={() => {
                        setIsOpen(false)
                        setShowDemoModal(true)
                    }}
                >
                    Get a Demo
                </Button>
              </div>
            </div>
          </div>
        )}


      <BookDemoModal open={showDemoModal} onOpenChange={setShowDemoModal} />
    </>
  )
}
