"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib-landing/utils";

export const HeroBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let mouse = { x: -1000, y: -1000 };
    let rotation = { x: 0, y: 0 };
    // Constant slow rotation + mouse target
    let targetRotation = { x: 0.001, y: 0.001 };

    // Config
    const PARTICLE_COUNT = 4000;
    const SPHERE_RADIUS = 700;
    const FOCAL_LENGTH = 400;
    const VISIBILITY_RADIUS = 400;

    class Particle {
      x: number;
      y: number;
      z: number;
      size: number;
      color: string;

      constructor() {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = SPHERE_RADIUS * (0.8 + Math.random() * 0.2); 

        this.x = r * Math.sin(phi) * Math.cos(theta);
        this.y = r * Math.sin(phi) * Math.sin(theta);
        this.z = r * Math.cos(phi);

        this.size = Math.random() * 1.5 + 0.5;
        
        // Darker, high-contrast palette for visibility on white
        // Deep Blue, Indigo, Slate-Blue
        const colors = ['#1e40af', '#3b82f6', '#1d4ed8', '#4338ca', '#0f172a']; 
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      rotate(rotX: number, rotY: number) {
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = this.x * cosY - this.z * sinY;
        const z1 = this.z * cosY + this.x * sinY;

        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y2 = this.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + this.y * sinX;

        this.x = x1;
        this.y = y2;
        this.z = z2;
      }
    }
    
    const initParticles = () => {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
      }
    };

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      
      // Time-based wave for organic float
      const time = Date.now() * 0.001;

      // MUCH SLOWER ROTATION + SMOOTHING
      // Reduced sensitivity further and added Lerp for fluid motion
      const targetSpeedX = (mouse.y - cy) * 0.000005; // Extremely slow base speed
      const targetSpeedY = (mouse.x - cx) * 0.000005;

      // Smooth interpolation (Lerp) - gives "weight" to the rotation
      rotation.x += (targetSpeedX - rotation.x) * 0.02;
      rotation.y += (targetSpeedY - rotation.y) * 0.02;
      
      if (mouse.x === -1000) {
          rotation.x = 0.0002;
          rotation.y = 0.0004;
      }

      particles.forEach((p, i) => {
        // Individual organic drift
        // Each particle floats slightly on its own wave
        const floatX = Math.sin(time + i * 0.1) * 0.5;
        const floatY = Math.cos(time + i * 0.1) * 0.5;
        const floatZ = Math.sin(time + i * 0.5) * 0.5;

        // Apply rotation to base coordinates + float
        // Note: We use a temp variable for rotation so we don't accumulate errors 
        // but here we are modifying state dependent on previous? 
        // Actually the previous rotate() function mutates x,y,z.
        // To keep it organic but stable, we should probably rotate the *Original* + float?
        // But for this simple engine, mutating is fine if we normalize or just keep it gentle.
        
        // Let's modify rotate to accept the drift
        p.x += floatX;
        p.y += floatY;
        p.z += floatZ;

        p.rotate(rotation.x, rotation.y);
        
        const scale = FOCAL_LENGTH / (FOCAL_LENGTH + p.z);
        if (scale < 0) return;

        const projX = p.x * scale + cx;
        const projY = p.y * scale + cy;

        const dx = mouse.x - projX;
        const dy = mouse.y - projY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Visibility Logic
        if (dist < VISIBILITY_RADIUS) {
            let alpha = 1 - (dist / VISIBILITY_RADIUS);
            // Make them more visible: less aggressive fade and higher base opacity
            alpha = Math.min(alpha * 2, 1);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            const radius = Math.min(p.size * scale, 3); // Cap max size
            ctx.arc(projX, projY, radius, 0, Math.PI * 2);
            ctx.fill();
        }
      });
      
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      if (containerRef.current && canvas) {
        canvas.width = containerRef.current.offsetWidth;
        canvas.height = containerRef.current.offsetHeight;
        initParticles();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
        // Don't reset mouse, let it stay at last position (looks cooler, like you left the object tilted)
        // Or reset to center to 'level' it?
        // Let's reset to center for 'Antigravity' feel (returns to equilibrium)
        if (canvas) {
            mouse.x = canvas.width / 2;
            mouse.y = canvas.height / 2;
        }
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    handleResize();
    // Initialize interaction at center (0 tilt)
    if (canvas) {
        mouse.x = canvas.width / 2;
        mouse.y = canvas.height / 2;
    }
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden z-0">
      <canvas ref={canvasRef} className="absolute inset-0 block" />
       {/* Removed heavy overlays */}
       <div className="absolute inset-0 bg-transparent z-10 pointer-events-none" />
    </div>
  );
};
