import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { DetailLevel } from './Sidebar';

export interface BubbleNode {
  id: string;
  label: string;
  category: string;
  minutes: number;
  intensity: number;
  share: number;
  color: string;
}

interface BubbleMapProps {
  detailLevel: DetailLevel;
  items: BubbleNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const MAX_ITEMS_BY_LEVEL: Record<DetailLevel, number> = {
  overview: 6,
  detailed: 8,
  deep: 10,
};

function BubbleMap({ detailLevel, items, selectedId, onSelect }: BubbleMapProps) {
  const visibleItems = useMemo(
    () => items.slice(0, MAX_ITEMS_BY_LEVEL[detailLevel]),
    [detailLevel, items],
  );

  const layout = useMemo(() => {
    const total = visibleItems.length || 1;
    return visibleItems.map((item, index) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      const radius = index === 0 ? 0 : 22 + (index % 4) * 8;
      const x = 50 + Math.cos(angle) * radius;
      const y = 48 + Math.sin(angle) * (radius * 0.7);
      const size = 86 + Math.min(item.intensity, 90) * 0.9;
      return { ...item, x, y, size, delay: index * 0.08 };
    });
  }, [visibleItems]);

  if (visibleItems.length === 0) {
    return (
      <div className="rounded-[26px] border border-dashed border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-6 text-sm text-[var(--pi-text-soft)]">
        Bubble intelligence activates as soon as feature-level engagement data starts flowing in.
      </div>
    );
  }

  const selectedBubble = visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0];
  const categories = Array.from(new Set(visibleItems.map((item) => item.category)));

  return (
    <div className="space-y-4">
      <div className="pi-mesh pi-soft-grid relative h-[22rem] overflow-hidden rounded-[28px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)]">
        {layout.map((item, index) => {
          const active = item.id === (selectedId ?? selectedBubble.id);
          return (
            <motion.button
              key={item.id}
              layout
              type="button"
              onClick={() => onSelect(item.id)}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: active ? 1.02 : 1 }}
              transition={{ duration: 0.35, delay: item.delay }}
              className={`pi-floating absolute flex flex-col items-center justify-center rounded-full border px-3 text-center ${
                active ? 'z-10 shadow-2xl' : 'z-0'
              } ${index % 2 === 0 ? 'pi-floating-delay' : 'pi-floating-slow'}`}
              style={{
                left: `calc(${item.x}% - ${item.size / 2}px)`,
                top: `calc(${item.y}% - ${item.size / 2}px)`,
                width: `${item.size}px`,
                height: `${item.size}px`,
                background: `radial-gradient(circle at 30% 30%, ${item.color}44, ${item.color}18)`,
                borderColor: active ? item.color : `${item.color}66`,
                boxShadow: active ? `0 18px 40px -24px ${item.color}` : 'none',
              }}
            >
              <div className="max-w-[80%] text-sm font-semibold text-[var(--pi-text)]">{item.label}</div>
              <div className="mt-1 text-[0.68rem] text-[var(--pi-text-soft)]">{Math.round(item.share)}% share</div>
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <div
            key={category}
            className="rounded-full border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] px-3 py-1.5 text-[0.7rem] font-semibold text-[var(--pi-text-soft)]"
          >
            {category}
          </div>
        ))}
      </div>

      {selectedBubble && (
        <div className="rounded-[24px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--pi-text)]">{selectedBubble.label}</div>
              <div className="text-xs text-[var(--pi-text-soft)]">{selectedBubble.category} engagement signal</div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-[var(--pi-text-soft)]">
              <span className="rounded-full border border-[var(--pi-border)] px-2.5 py-1">
                {selectedBubble.minutes.toFixed(0)} mins tracked
              </span>
              <span className="rounded-full border border-[var(--pi-border)] px-2.5 py-1">
                {selectedBubble.intensity.toFixed(0)} engagement intensity
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(BubbleMap);
