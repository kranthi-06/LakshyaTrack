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
}

interface RenderSettings {
  connectionDistance: number;
  connectionDistanceSq: number;
  mouseRadius: number;
  mouseRadiusSq: number;
  particleCountFactor: number;
  minParticles: number;
  targetFps: number;
  frameInterval: number;
  maxSpeed: number;
  dprCap: number;
}

function detectLowPowerDevice() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return lowMemory || lowCpu || prefersReducedMotion;
}

function buildSettings(width: number): RenderSettings {
  const lowPower = detectLowPowerDevice();
  const mobile = width < 1024;

  const connectionDistance = lowPower ? 130 : mobile ? 150 : 170;
  const mouseRadius = lowPower ? 140 : mobile ? 190 : 240;
  const particleCountFactor = lowPower ? 0.000015 : mobile ? 0.00002 : 0.000028;
  const minParticles = lowPower ? 22 : mobile ? 28 : 35;
  const targetFps = lowPower ? 24 : mobile ? 28 : 30;
  const maxSpeed = lowPower ? 0.95 : 1.2;
  const dprCap = lowPower ? 1 : mobile ? 1.2 : 1.5;

  return {
    connectionDistance,
    connectionDistanceSq: connectionDistance * connectionDistance,
    mouseRadius,
    mouseRadiusSq: mouseRadius * mouseRadius,
    particleCountFactor,
    minParticles,
    targetFps,
    frameInterval: 1000 / targetFps,
    maxSpeed,
    dprCap,
  };
}

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const timeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0 });
  const settingsRef = useRef<RenderSettings>(buildSettings(window.innerWidth));
  const isDocumentVisibleRef = useRef(!document.hidden);
  const isCanvasVisibleRef = useRef(true);

  const isDark = () => document.documentElement.classList.contains('dark');

  const createParticles = useCallback((width: number, height: number) => {
    const settings = settingsRef.current;
    const count = Math.max(
      settings.minParticles,
      Math.floor(width * height * settings.particleCountFactor),
    );

    const particles: Particle[] = [];
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2.5 + 1.2,
        opacity: Math.random() * 0.45 + 0.35,
        pulseSpeed: Math.random() * 0.025 + 0.008,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    return particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const nextSettings = buildSettings(rect.width);
      settingsRef.current = nextSettings;

      const dpr = Math.min(window.devicePixelRatio || 1, nextSettings.dprCap);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      sizeRef.current = { width: rect.width, height: rect.height };
      particlesRef.current = createParticles(rect.width, rect.height);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const visibilityHandler = () => {
      isDocumentVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isCanvasVisibleRef.current = !!entry?.isIntersecting;
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(parent);

    let mouseMoveTimer: ReturnType<typeof setTimeout> | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      if (mouseMoveTimer) return;
      mouseMoveTimer = setTimeout(() => {
        mouseMoveTimer = null;
      }, 32);

      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);

    const animate = (now: number) => {
      const settings = settingsRef.current;
      animationRef.current = requestAnimationFrame(animate);

      if (!isDocumentVisibleRef.current || !isCanvasVisibleRef.current) return;

      const elapsed = now - lastFrameTimeRef.current;
      if (elapsed < settings.frameInterval) return;
      lastFrameTimeRef.current = now - (elapsed % settings.frameInterval);

      const { width: w, height: h } = sizeRef.current;
      if (!w || !h) return;

      timeRef.current += 1;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const dark = isDark();

      const lineR = dark ? 56 : 139;
      const lineG = dark ? 189 : 92;
      const lineB = dark ? 248 : 246;
      const mouseR = dark ? 99 : 236;
      const mouseG = dark ? 102 : 72;
      const mouseB = dark ? 241 : 153;
      const glow1R = dark ? 56 : 168;
      const glow1G = dark ? 189 : 85;
      const glow1B = dark ? 248 : 247;
      const glow2R = dark ? 99 : 251;
      const glow2G = dark ? 102 : 113;
      const glow2B = dark ? 241 : 133;
      const dotR = dark ? 147 : 124;
      const dotG = dark ? 197 : 58;
      const dotB = dark ? 253 : 237;

      const lineAlpha = dark ? 0.3 : 0.35;
      const mouseLineAlpha = 0.45;
      const glowAlpha = 0.65;
      const dotAlpha = dark ? 0.95 : 0.9;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < settings.mouseRadiusSq && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const force = ((settings.mouseRadius - dist) / settings.mouseRadius) * 0.025;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        const speed = Math.hypot(p.vx, p.vy);
        if (speed > settings.maxSpeed) {
          p.vx = (p.vx / speed) * settings.maxSpeed;
          p.vy = (p.vy / speed) * settings.maxSpeed;
        }

        p.vx *= 0.998;
        p.vy *= 0.998;
      }

      for (let i = 0; i < particles.length; i += 1) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < settings.connectionDistanceSq) {
            const dist = Math.sqrt(distSq);
            const alpha = (1 - dist / settings.connectionDistance) * lineAlpha;

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${lineR}, ${lineG}, ${lineB}, ${alpha})`;
            ctx.lineWidth = dark ? 0.8 : 0.7;
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < settings.mouseRadiusSq) {
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / settings.mouseRadius) * mouseLineAlpha;

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(${mouseR}, ${mouseG}, ${mouseB}, ${alpha})`;
          ctx.lineWidth = dark ? 1 : 0.8;
          ctx.stroke();
        }
      }

      for (const p of particles) {
        const pulse = Math.sin(timeRef.current * p.pulseSpeed + p.pulsePhase);
        const currentRadius = p.radius + pulse * 0.7;
        const currentOpacity = p.opacity + pulse * 0.15;

        const glowRadius = currentRadius * (dark ? 5.5 : 5);
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
        gradient.addColorStop(0, `rgba(${glow1R}, ${glow1G}, ${glow1B}, ${currentOpacity * glowAlpha})`);
        gradient.addColorStop(0.35, `rgba(${glow2R}, ${glow2G}, ${glow2B}, ${currentOpacity * glowAlpha * 0.3})`);
        gradient.addColorStop(1, `rgba(${glow1R}, ${glow1G}, ${glow1B}, 0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotR}, ${dotG}, ${dotB}, ${currentOpacity * dotAlpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity * (dark ? 0.7 : 0.5)})`;
        ctx.fill();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', visibilityHandler);
      intersectionObserver.disconnect();
      if (mouseMoveTimer) clearTimeout(mouseMoveTimer);
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
        willChange: 'transform',
      }}
    />
  );
}

