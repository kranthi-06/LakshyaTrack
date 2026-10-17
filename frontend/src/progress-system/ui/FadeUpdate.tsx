import { useRef, useEffect, useState, memo, type ReactNode } from 'react';

interface FadeUpdateProps {
  /** Key that triggers the fade transition when it changes */
  updateKey: string | number;
  /** Duration of the fade in milliseconds */
  duration?: number;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wrapper that applies a subtle fade transition when content updates.
 * Prevents flickering by cross-fading old and new content.
 */
function FadeUpdateInner({
  updateKey,
  duration = 300,
  children,
  className = '',
  style: externalStyle,
}: FadeUpdateProps) {
  const [opacity, setOpacity] = useState(1);
  const prevKeyRef = useRef(updateKey);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevKeyRef.current === updateKey) return;
    prevKeyRef.current = updateKey;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    // Fade out slightly, then fade back in. Schedule the first setState on the
    // next animation frame so it is not synchronous inside the effect body.
    const handleFrame = () => {
        setOpacity(0.6);
        timerRef.current = window.setTimeout(() => {
            setOpacity(1);
            timerRef.current = null;
        }, 50);
    };
    const raf = window.requestAnimationFrame(handleFrame);

    return () => {
      window.cancelAnimationFrame(raf);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [updateKey]);

  return (
    <div
      className={className}
      style={{
        ...externalStyle,
        opacity,
        transition: `opacity ${duration}ms ease-out`,
      }}
    >
      {children}
    </div>
  );
}

export const FadeUpdate = memo(FadeUpdateInner);
export default FadeUpdate;
