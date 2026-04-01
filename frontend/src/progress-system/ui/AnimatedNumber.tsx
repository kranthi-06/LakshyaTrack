import { useEffect, useRef, useState, memo } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  formatFn?: (value: number) => string;
}

/**
 * Smoothly animates between numeric values using requestAnimationFrame.
 * Used in dashboard stat cards for a premium "live counter" feel.
 */
function AnimatedNumberInner({
  value,
  duration = 600,
  className,
  formatFn,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = to;

    if (from === to) return;

    const startTime = performance.now();
    const diff = to - from;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + diff * eased);
      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      }
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  const formatted = formatFn ? formatFn(displayValue) : String(displayValue);

  return <span className={className}>{formatted}</span>;
}

export const AnimatedNumber = memo(AnimatedNumberInner);
export default AnimatedNumber;
