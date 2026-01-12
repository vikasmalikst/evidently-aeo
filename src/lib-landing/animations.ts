"use client"

import { motion, Variants, Transition } from "framer-motion"

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
}

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
}

// Check for reduced motion preference
const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

export const defaultAnimationOptions = {
  initial: "hidden",
  whileInView: "visible",
  viewport: { once: true, margin: "-100px" },
  transition: prefersReducedMotion
    ? { duration: 0.01 }
    : ({ duration: 0.6, ease: "easeOut" } as Transition),
}

export const MotionDiv = motion.div
export const MotionSection = motion.section

