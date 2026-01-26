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
  const [isScrolled, setIsScrolled] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    const handleScroll = () => {
        setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navVariants = {
    top: {
      backgroundColor: "rgba(255, 255, 255, 0)",
      borderBottomColor: "rgba(0,0,0,0)",
      paddingTop: "1rem",
      paddingBottom: "1rem",
      boxShadow: "0 0 0 0 rgba(0,0,0,0)",
    },
    scrolled: {
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      borderBottomColor: "var(--border)",
      paddingTop: "0.375rem",
      paddingBottom: "0.375rem",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    }
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <motion.nav
          initial="top"
          animate={isScrolled ? "scrolled" : "top"}
          variants={navVariants}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={cn(
            "pointer-events-auto w-full backdrop-blur-md transition-colors",
             // Dark mode colors applied via classes to handle the "paint" of the semi-transparent layers correctly
             isScrolled 
                ? "bg-white/90 dark:bg-zinc-950/90" 
                : "bg-transparent"
          )}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group shrink-0">
                <img
                src="/evidentlyaeo-logo.png"
                alt="EvidentlyAEO Logo"
                className="h-8 w-8"
                />
                <span className={cn(
                    "text-lg font-bold tracking-tight transition-colors",
                    "text-slate-900 dark:text-white" 
                )}>
                EvidentlyAEO
                </span>
            </Link>
            
            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-1">
                {navLinks.map((link, index) => (
                <a
                    key={link.name}
                    href={link.href}
                    className="relative text-base font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-4 py-2 rounded-full cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={(e) => {
                    e.preventDefault();
                    const element = document.querySelector(link.href);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                    }
                    }}
                >
                    {/* Animated Background Pill - Kept for hover effect */}
                    {hoveredIndex === index && (
                    <motion.span
                        className="absolute inset-0 bg-slate-200/50 dark:bg-slate-800/80 rounded-full -z-10"
                        layoutId="navbar-hover"
                        transition={{
                        type: "spring",
                        bounce: 0,
                        duration: 0.6
                        }}
                    />
                    )}
                    <span className="relative z-10">{link.name}</span>
                </a>
                ))}
            </div>

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
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-full px-6 py-2 shadow-[0_2px_15px_-3px_rgba(6,182,212,0.4)] hover:shadow-[0_8px_25px_-5px_rgba(6,182,212,0.6)] transition-all hover:-translate-y-0.5 h-10 text-sm border-t border-white/20 relative overflow-hidden group"
                >
                <div className="absolute inset-0 bg-white/20 group-hover:bg-transparent transition-colors" />
                <span className="relative z-10">Get a Demo</span>
                </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-full text-muted-foreground hover:bg-slate-200/50 transition-colors ml-auto"
            >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </motion.nav>
      </div>

       {/* Mobile Menu Overlay */}
       {isOpen && (
          <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm md:hidden pt-24 px-6 animate-in fade-in slide-in-from-top-4 duration-200">
             <div className="flex flex-col space-y-4">
               {navLinks.map((link) => (
                <a
                  key={link.name} 
                  href={link.href}
                  className="flex items-center justify-between py-4 border-b border-border text-lg font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(false);
                    const element = document.querySelector(link.href);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  {link.name}
                  <ArrowRight className="w-5 h-5 opacity-50" />
                </a>
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
