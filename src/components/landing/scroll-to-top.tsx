"use client"

import { useEffect } from "react"
import { useLocation } from "react-router-dom"

export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Only scroll to top if there is no hash in the URL
    if (!window.location.hash) {
      window.scrollTo(0, 0)
    }
    
    // Attempt to clear hash if present on refresh? 
    // The user specifically said "on refreshing the page".
    // If we want to FORCE hero section, we should scroll to (0,0) regardless of hash, 
    // unless that breaks navigation.
    // Let's try to gently force it if the user just refreshed.
    
    // Actually, simply scrolling to 0,0 on mount usually works for "landing page feel".
    window.scrollTo(0, 0)
    
  }, [pathname])

  return null
}
