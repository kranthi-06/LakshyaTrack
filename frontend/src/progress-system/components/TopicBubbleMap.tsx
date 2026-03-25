// ══════════════════════════════════════════════════════════════
// Interactive Topic / Skill Bubble Map Component (D3-style SVG)
// ══════════════════════════════════════════════════════════════

import { useState, useMemo, useRef, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TopicMapData, TopicBubble } from '../types';

interface Props {
  data: TopicMapData;
}

interface BubblePosition {
  x: number;
  y: number;
  r: number;
  topic: TopicBubble;
}

const PROFICIENCY_COLORS: Record<string, string> = {
  beginner: '#64748b',
  intermediate: '#3b82f6',
  advanced: '#8b5cf6',
  expert: '#f59e0b',
};

const PROFICIENCY_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

// Simple circle packing algorithm
function packBubbles(topics: TopicBubble[], width: number, height: number): BubblePosition[] {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxSize = Math.max(...topics.map(t => t.size));
  const minRadius = 22;
  const maxRadius = Math.min(width, height) * 0.14;

  const bubbles: BubblePosition[] = topics.map(topic => {
    const normalizedSize = topic.size / maxSize;
    const r = minRadius + normalizedSize * (maxRadius - minRadius);
    return { x: 0, y: 0, r, topic };
  });

  // Sort by size descending for better packing
  bubbles.sort((a, b) => b.r - a.r);

  // Place bubbles using spiral layout
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  bubbles.forEach((bubble, i) => {
    if (i === 0) {
      bubble.x = centerX;
      bubble.y = centerY;
      return;
    }

    const angle = i * goldenAngle;
    const spiralRadius = Math.sqrt(i) * (maxRadius * 0.8);
    let x = centerX + Math.cos(angle) * spiralRadius;
    let y = centerY + Math.sin(angle) * spiralRadius;

    // Collision resolution
    let attempts = 0;
    while (attempts < 50) {
      let hasCollision = false;
      for (let j = 0; j < i; j++) {
        const dx = x - bubbles[j].x;
        const dy = y - bubbles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = bubble.r + bubbles[j].r + 4;

        if (dist < minDist) {
          hasCollision = true;
          const overlap = minDist - dist;
          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);
          x += nx * (overlap * 0.6);
          y += ny * (overlap * 0.6);
        }
      }
      if (!hasCollision) break;
      attempts++;
    }

    // Clamp to bounds
    bubble.x = Math.max(bubble.r + 5, Math.min(width - bubble.r - 5, x));
    bubble.y = Math.max(bubble.r + 5, Math.min(height - bubble.r - 5, y));
  });

  return bubbles;
}

const TopicBubbleMap = memo(function TopicBubbleMap({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [selectedTopic, setSelectedTopic] = useState<TopicBubble | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(350, entry.contentRect.width * 0.6),
        });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const categories = useMemo(() => {
    return ['all', ...new Set(data.topics.map(t => t.category))];
  }, [data.topics]);

  const filteredTopics = useMemo(() => {
    if (categoryFilter === 'all') return data.topics;
    return data.topics.filter(t => t.category === categoryFilter);
  }, [data.topics, categoryFilter]);

  const bubbles = useMemo(() => {
    return packBubbles(filteredTopics, dimensions.width, dimensions.height);
  }, [filteredTopics, dimensions]);

  const handleBubbleClick = useCallback((topic: TopicBubble) => {
    setSelectedTopic(prev => prev?.id === topic.id ? null : topic);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-2xl p-6 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-xl">🫧</span>
            Skill Map
          </h3>
          <p className="text-xs text-white/40 mt-1">
            Strongest: <span className="text-emerald-400">{data.strongestTopic}</span>
            {' · '}
            Focus area: <span className="text-amber-400">{data.weakestTopic}</span>
          </p>
        </div>

        {/* Proficiency legend */}
        <div className="flex items-center gap-3">
          {Object.entries(PROFICIENCY_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: PROFICIENCY_COLORS[key] }} />
              <span className="text-xs text-white/40">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => { setCategoryFilter(cat); setSelectedTopic(null); }}
            className="px-3 py-1 text-xs rounded-full transition-all"
            style={{
              background: categoryFilter === cat ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              color: categoryFilter === cat ? '#818cf8' : 'rgba(255,255,255,0.5)',
              border: `1px solid ${categoryFilter === cat ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {cat === 'all' ? 'All Topics' : cat}
          </button>
        ))}
      </div>

      {/* Bubble Map SVG */}
      <div ref={containerRef} className="relative rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <svg width={dimensions.width} height={dimensions.height}>
          <defs>
            {bubbles.map(b => (
              <radialGradient key={`grad-${b.topic.id}`} id={`bubbleGrad-${b.topic.id}`}>
                <stop offset="0%" stopColor={PROFICIENCY_COLORS[b.topic.proficiencyLevel]} stopOpacity="0.3" />
                <stop offset="70%" stopColor={PROFICIENCY_COLORS[b.topic.proficiencyLevel]} stopOpacity="0.15" />
                <stop offset="100%" stopColor={PROFICIENCY_COLORS[b.topic.proficiencyLevel]} stopOpacity="0.05" />
              </radialGradient>
            ))}
          </defs>

          {bubbles.map((b, i) => {
            const isHovered = hoveredId === b.topic.id;
            const isSelected = selectedTopic?.id === b.topic.id;
            const profColor = PROFICIENCY_COLORS[b.topic.proficiencyLevel];

            return (
              <g key={b.topic.id}>
                {/* Glow effect */}
                <motion.circle
                  cx={b.x}
                  cy={b.y}
                  r={b.r + 4}
                  fill="none"
                  stroke={profColor}
                  strokeWidth={isSelected ? 2 : 0}
                  strokeOpacity={0.4}
                  initial={{ r: 0, opacity: 0 }}
                  animate={{
                    r: b.r + (isHovered ? 6 : 4),
                    opacity: isSelected || isHovered ? 1 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                />

                {/* Main bubble */}
                <motion.circle
                  cx={b.x}
                  cy={b.y}
                  fill={`url(#bubbleGrad-${b.topic.id})`}
                  stroke={profColor}
                  strokeWidth={isHovered || isSelected ? 2 : 1}
                  strokeOpacity={isHovered || isSelected ? 0.7 : 0.3}
                  className="cursor-pointer"
                  initial={{ r: 0, opacity: 0 }}
                  animate={{
                    r: isHovered ? b.r * 1.08 : b.r,
                    opacity: 1,
                  }}
                  transition={{
                    r: { duration: 0.8, delay: i * 0.04, type: 'spring', stiffness: 200, damping: 15 },
                    opacity: { duration: 0.5, delay: i * 0.04 },
                  }}
                  onMouseEnter={() => setHoveredId(b.topic.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleBubbleClick(b.topic)}
                  style={{ filter: isHovered ? `drop-shadow(0 0 12px ${profColor}60)` : 'none' }}
                />

                {/* Label */}
                {b.r > 28 && (
                  <motion.text
                    x={b.x}
                    y={b.y - (b.r > 40 ? 6 : 0)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={Math.max(9, Math.min(13, b.r * 0.32))}
                    fontWeight="600"
                    fontFamily="Inter, sans-serif"
                    className="pointer-events-none select-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 + 0.5 }}
                  >
                    {b.topic.name}
                  </motion.text>
                )}

                {/* Sub-label (problem count) */}
                {b.r > 40 && (
                  <motion.text
                    x={b.x}
                    y={b.y + 12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="rgba(255,255,255,0.45)"
                    fontSize="10"
                    fontFamily="Inter, sans-serif"
                    className="pointer-events-none select-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 + 0.6 }}
                  >
                    {b.topic.problemsSolved} solved
                  </motion.text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedTopic && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div
              className="p-4 rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${PROFICIENCY_COLORS[selectedTopic.proficiencyLevel]}10, transparent)`,
                border: `1px solid ${PROFICIENCY_COLORS[selectedTopic.proficiencyLevel]}25`,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-base font-semibold text-white flex items-center gap-2">
                    {selectedTopic.name}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: `${PROFICIENCY_COLORS[selectedTopic.proficiencyLevel]}20`,
                        color: PROFICIENCY_COLORS[selectedTopic.proficiencyLevel],
                      }}
                    >
                      {PROFICIENCY_LABELS[selectedTopic.proficiencyLevel]}
                    </span>
                  </h4>
                  <p className="text-xs text-white/40 mt-0.5">Category: {selectedTopic.category}</p>
                </div>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="text-white/40 hover:text-white transition-colors text-lg"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-lg font-bold text-white">{selectedTopic.problemsSolved}</div>
                  <div className="text-xs text-white/40">Problems</div>
                </div>
                <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-lg font-bold text-white">
                    {Math.round(selectedTopic.timeSpentMinutes / 60)}h
                  </div>
                  <div className="text-xs text-white/40">Time Spent</div>
                </div>
                <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-lg font-bold" style={{ color: PROFICIENCY_COLORS[selectedTopic.proficiencyLevel] }}>
                    {selectedTopic.proficiencyScore}%
                  </div>
                  <div className="text-xs text-white/40">Proficiency</div>
                </div>
                <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-lg font-bold text-white">
                    {Math.round(selectedTopic.problemsSolved / Math.max(1, selectedTopic.timeSpentMinutes / 60) * 10) / 10}
                  </div>
                  <div className="text-xs text-white/40">Problems/hr</div>
                </div>
              </div>

              {/* Proficiency bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/40">Proficiency Score</span>
                  <span style={{ color: PROFICIENCY_COLORS[selectedTopic.proficiencyLevel] }}>
                    {selectedTopic.proficiencyScore}/100
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: PROFICIENCY_COLORS[selectedTopic.proficiencyLevel] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedTopic.proficiencyScore}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default TopicBubbleMap;
