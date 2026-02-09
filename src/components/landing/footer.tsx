"use client"

import { Link } from 'react-router-dom';
import { Twitter, Linkedin, Github, Send, Heart, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/landing/ui/button"
import { Input } from "@/components/landing/ui/input"
import { motion } from "framer-motion"

const footerLinks = {
  product: [
    { name: "Features", href: "#" },
    { name: "Pricing", href: "#pricing" },
    { name: "Security", href: "#" },
    { name: "Changelog", href: "#" },
    { name: "Documentation", href: "#" },
  ],
  company: [
    { name: "About", href: "#" },
    { name: "Blog", href: "#" },
    { name: "Careers", href: "#", badge: "Hiring" },
    { name: "Customers", href: "#" },
    { name: "Contact", href: "#" },
  ],
  legal: [
    { name: "Privacy Policy", href: "#" },
    { name: "Terms of Service", href: "#" },
    { name: "Cookie Policy", href: "#" },
    { name: "Compliance", href: "#" },
  ],
}

const socialLinks = [
  { name: "Twitter", icon: Twitter, href: "https://twitter.com" },
  { name: "LinkedIn", icon: Linkedin, href: "https://linkedin.com" },
  { name: "GitHub", icon: Github, href: "https://github.com" },
]

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-200 py-16 lg:py-24 border-t border-slate-800 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
      <div className="absolute -top-[500px] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-cyan-500/5 blur-3xl rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 lg:gap-8 mb-16">
          
          {/* Brand & Newsletter - Wide Column */}
          <div className="lg:col-span-2 space-y-6">
            <Link to="/" className="flex items-center gap-2 group w-fit">
               <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <img
                    src="/evidentlyaeo-logo.png"
                    alt="Logo"
                    className="h-6 w-6 brightness-0 invert"
                  />
               </div>
              <span className="text-xl font-bold text-white tracking-tight">EvidentlyAEO</span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              The only platform connecting AI visibility to measurable revenue outcomes. Stop guessing, start ranking.
            </p>
            
            {/* Newsletter */}
            <div className="pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-white">Subscribe to our newsletter</h4>
              <div className="flex gap-2 max-w-sm">
                <Input 
                  placeholder="Enter your email" 
                  className="bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/50"
                  type="email"
                />
                <Button size="icon" className="bg-cyan-600 hover:bg-cyan-500 text-white shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-500">Unsubscribe at any time.</p>
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-3 gap-8">
            {/* Product */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Product</h4>
              <ul className="space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.name}>
                    <Link to={link.href} className="text-sm text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1 group">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Company</h4>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.name}>
                    <Link to={link.href} className="text-sm text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1 group">
                      {link.name}
                      {link.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Legal</h4>
              <ul className="space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.name}>
                    <Link to={link.href} className="text-sm text-slate-400 hover:text-cyan-400 transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500 flex flex-col md:flex-row items-center gap-2 md:gap-4">
            <span>© 2025 EvidentlyAEO, Inc.</span>
            <span className="hidden md:inline text-slate-700">•</span>
            {/* <span className="flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> in San Francisco
            </span> */}
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => {
              const Icon = social.icon
              return (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all duration-300 group"
                  aria-label={social.name}
                >
                  <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </footer>
  )
}
