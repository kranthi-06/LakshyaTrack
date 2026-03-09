import { useRef, useEffect, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  pulseSpeed: number;
  pulsePhase: number;
  hueOffset: number;
}

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const timeRef = useRef(0);

  const CONNECTION_DISTANCE = 170;
  const MOUSE_RADIUS = 240;
  const PARTICLE_COUNT_FACTOR = 0.000045;

  const isDark = () => document.documentElement.classList.contains('dark');

  const createParticles = useCallback((width: number, height: number) => {
    const count = Math.max(55, Math.floor(width * height * PARTICLE_COUNT_FACTOR));
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2.5 + 1.2,
        opacity: Math.random() * 0.45 + 0.4,
        pulseSpeed: Math.random() * 0.025 + 0.008,
        pulsePhase: Math.random() * Math.PI * 2,
        hueOffset: Math.random() * 40 - 20,
      });
    }
    return particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = createParticles(rect.width, rect.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const animate = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const w = rect.width;
      const h = rect.height;
      timeRef.current += 1;

      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const dark = isDark();

      // ── Theme-aware color palettes ──
      // Light mode: warm violet/rose/amber — vivid and beautiful
      // Dark mode: cool cyan/indigo/blue — like the reference image
      const lightLineR = 139, lightLineG = 92, lightLineB = 246;   // violet
      const lightMouseR = 236, lightMouseG = 72, lightMouseB = 153; // rose
      const lightGlowR = 168, lightGlowG = 85, lightGlowB = 247;  // purple
      const lightGlow2R = 251, lightGlow2G = 113, lightGlow2B = 133;// rose
      const lightDotR = 124, lightDotG = 58, lightDotB = 237;      // vivid purple

      const darkLineR = 56, darkLineG = 189, darkLineB = 248;      // cyan
      const darkMouseR = 99, darkMouseG = 102, darkMouseB = 241;    // indigo
      const darkGlowR = 56, darkGlowG = 189, darkGlowB = 248;      // cyan
      const darkGlow2R = 99, darkGlow2G = 102, darkGlow2B = 241;    // indigo
      const darkDotR = 147, darkDotG = 197, darkDotB = 253;         // light blue

      const lineR = dark ? darkLineR : lightLineR;
      const lineG = dark ? darkLineG : lightLineG;
      const lineB = dark ? darkLineB : lightLineB;
      const mouseR = dark ? darkMouseR : lightMouseR;
      const mouseG = dark ? darkMouseG : lightMouseG;
      const mouseB = dark ? darkMouseB : lightMouseB;
      const glow1R = dark ? darkGlowR : lightGlowR;
      const glow1G = dark ? darkGlowG : lightGlowG;
      const glow1B = dark ? darkGlowB : lightGlowB;
      const glow2R = dark ? darkGlow2R : lightGlow2R;
      const glow2G = dark ? darkGlow2G : lightGlow2G;
      const glow2B = dark ? darkGlow2B : lightGlow2B;
      const dotR = dark ? darkDotR : lightDotR;
      const dotG = dark ? darkDotG : lightDotG;
      const dotB = dark ? darkDotB : lightDotB;

      const lineAlpha = dark ? 0.3 : 0.35;
      const mouseLineAlpha = dark ? 0.45 : 0.45;
      const glowAlpha = dark ? 0.65 : 0.65;
      const dotAlpha = dark ? 0.95 : 0.9;

      // Update positions
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));

        // Mouse interaction — particles gently move away
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.025;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Speed limit
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 1.2) {
          p.vx = (p.vx / speed) * 1.2;
          p.vy = (p.vy / speed) * 1.2;
        }

        // Damping
        p.vx *= 0.998;
        p.vy *= 0.998;
      }

      // Draw connections between particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * lineAlpha;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${lineR}, ${lineG}, ${lineB}, ${alpha})`;
            ctx.lineWidth = dark ? 0.8 : 0.7;
            ctx.stroke();
          }
        }
      }

      // Draw lines from particles to mouse cursor
      for (const p of particles) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS) {
          const alpha = (1 - dist / MOUSE_RADIUS) * mouseLineAlpha;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(${mouseR}, ${mouseG}, ${mouseB}, ${alpha})`;
          ctx.lineWidth = dark ? 1.0 : 0.8;
          ctx.stroke();
        }
      }

      // Draw particles with glow
      for (const p of particles) {
        const pulse = Math.sin(timeRef.current * p.pulseSpeed + p.pulsePhase);
        const currentRadius = p.radius + pulse * 0.7;
        const currentOpacity = p.opacity + pulse * 0.15;

        // Outer glow
        const glowRadius = currentRadius * (dark ? 5.5 : 5);
        const gradient = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, glowRadius
        );
        gradient.addColorStop(0, `rgba(${glow1R}, ${glow1G}, ${glow1B}, ${currentOpacity * glowAlpha})`);
        gradient.addColorStop(0.35, `rgba(${glow2R}, ${glow2G}, ${glow2B}, ${currentOpacity * glowAlpha * 0.3})`);
        gradient.addColorStop(1, `rgba(${glow1R}, ${glow1G}, ${glow1B}, 0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core bright dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotR}, ${dotG}, ${dotB}, ${currentOpacity * dotAlpha})`;
        ctx.fill();

        // Tiny white center highlight
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity * (dark ? 0.7 : 0.5)})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationRef.current);
    };
  }, [createParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="network-bg-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        zIndex: 0,
      }}
    />
  );
}
