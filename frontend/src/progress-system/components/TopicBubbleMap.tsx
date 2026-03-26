import { useState, useMemo, useRef, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useTheme } from '../../context/ThemeContext';
import {
  mutedTextClassName,
  panelClassName,
  pillClassName,
  surfaceClassName,
  surfaceHoverClassName,
  titleTextClassName,
} from '../ui/surfaces';
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

interface BubbleTooltipState {
  x: number;
  y: number;
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

const EDGE_PADDING = 18;
const BUBBLE_PADDING = 12;
const TEXT_INSET = 8;
const surfaceCardClassName = `rounded-2xl p-5 ${surfaceClassName} ${surfaceHoverClassName}`;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function splitLabel(label: string, maxChars: number, maxLines: number) {
  const lines: string[] = [];
  let remaining = label.trim();

  for (let lineIndex = 0; lineIndex < maxLines && remaining; lineIndex += 1) {
    if (remaining.length <= maxChars) {
      lines.push(remaining);
      remaining = '';
      break;
    }

    const slice = remaining.slice(0, maxChars + 1);
    const lastSpace = slice.lastIndexOf(' ');
    const cut = lastSpace > maxChars * 0.55 ? lastSpace : maxChars;
    let line = remaining.slice(0, cut).trim();
    remaining = remaining.slice(cut).trim();

    if (lineIndex === maxLines - 1 && remaining) {
      line = `${line.slice(0, Math.max(1, maxChars - 1)).trimEnd()}...`;
      remaining = '';
    }

    lines.push(line);
  }

  return lines.filter(Boolean);
}

function getBubbleLabelLayout(label: string, outerRadius: number) {
  const innerRadius = outerRadius - TEXT_INSET;

  if (innerRadius < 20) {
    return { lines: [] as string[], fontSize: 0, subtitleSize: 0, titleStartY: 0, subtitleY: 0, showSubtitle: false };
  }

  const fontSize = clamp(Math.floor(innerRadius / 3.2), 9, 18);
  const maxCharsPerLine = clamp(Math.floor((innerRadius * 1.55) / (fontSize * 0.58)), 4, 14);
  const maxLines = innerRadius >= 48 ? 2 : 1;
  const lines = splitLabel(label, maxCharsPerLine, maxLines);
  const showSubtitle = innerRadius >= 58;
  const subtitleSize = clamp(Math.round(fontSize * 0.58), 9, 12);
  const lineSpacing = fontSize * 0.92;
  const subtitleGap = 6;
  const subtitleBlockHeight = subtitleSize * 0.95;
  const shiftUp = showSubtitle ? subtitleBlockHeight / 2 + subtitleGap / 2 : 0;
  const titleStartY = -((lines.length - 1) / 2) * lineSpacing - shiftUp;
  const subtitleY = showSubtitle ? ((lines.length - 1) / 2) * lineSpacing + shiftUp + subtitleGap : 0;

  if (showSubtitle) {
    const approxHalfHeight = ((lines.length - 1) * lineSpacing) / 2 + Math.max(fontSize, subtitleSize) * 0.55;
    if (approxHalfHeight > innerRadius * 0.96) {
      return {
        lines,
        fontSize,
        subtitleSize,
        titleStartY: -((lines.length - 1) / 2) * lineSpacing,
        subtitleY: 0,
        showSubtitle: false,
      };
    }
  }

  return {
    lines,
    fontSize,
    subtitleSize,
    titleStartY,
    subtitleY,
    showSubtitle,
  };
}

function packBubbles(topics: TopicBubble[], width: number, height: number): BubblePosition[] {
  if (topics.length === 0) return [];

  const centerX = width / 2;
  const centerY = height / 2;
  const maxSize = Math.max(1, ...topics.map((topic) => Math.max(topic.size, 1)));
  const minRadius = width < 700 ? 28 : 32;
  const maxRadius = Math.min(width, height) * 0.16;

  const bubbles: BubblePosition[] = topics
    .map((topic) => {
      const normalizedSize = Math.max(topic.size, 1) / maxSize;
      const radius = minRadius + normalizedSize * (maxRadius - minRadius);
      return { x: centerX, y: centerY, r: radius, topic };
    })
    .sort((left, right) => right.r - left.r);

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  bubbles.forEach((bubble, index) => {
    if (index === 0) {
      bubble.x = centerX;
      bubble.y = centerY;
      return;
    }

    const angle = index * goldenAngle;
    const orbit = Math.sqrt(index) * (maxRadius * 0.92);
    bubble.x = centerX + Math.cos(angle) * orbit;
    bubble.y = centerY + Math.sin(angle) * orbit;
  });

  for (let iteration = 0; iteration < 120; iteration += 1) {
    for (let first = 0; first < bubbles.length; first += 1) {
      for (let second = first + 1; second < bubbles.length; second += 1) {
        const left = bubbles[first];
        const right = bubbles[second];
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const distance = Math.hypot(dx, dy) || 0.0001;
        const minDistance = left.r + right.r + BUBBLE_PADDING;

        if (distance < minDistance) {
          const overlap = (minDistance - distance) / 2;
          const nx = dx / distance;
          const ny = dy / distance;

          if (first !== 0) {
            left.x -= nx * overlap;
            left.y -= ny * overlap;
          }

          right.x += nx * overlap;
          right.y += ny * overlap;
        }
      }
    }

    bubbles.forEach((bubble, index) => {
      const pullStrength = index === 0 ? 0.012 : 0.022;
      bubble.x += (centerX - bubble.x) * pullStrength;
      bubble.y += (centerY - bubble.y) * pullStrength;
      bubble.x = clamp(bubble.x, bubble.r + EDGE_PADDING, width - bubble.r - EDGE_PADDING);
      bubble.y = clamp(bubble.y, bubble.r + EDGE_PADDING, height - bubble.r - EDGE_PADDING);
    });
  }

  return bubbles;
}

const TopicBubbleMap = memo(function TopicBubbleMap({ data }: Props) {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 420 });
  const [selectedTopic, setSelectedTopic] = useState<TopicBubble | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredTopic, setHoveredTopic] = useState<BubbleTooltipState | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(380, entry.contentRect.width * 0.62),
        });
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const categories = useMemo(() => ['all', ...new Set(data.topics.map((topic) => topic.category))], [data.topics]);
  const filteredTopics = useMemo(
    () => (categoryFilter === 'all' ? data.topics : data.topics.filter((topic) => topic.category === categoryFilter)),
    [data.topics, categoryFilter],
  );
  const bubbles = useMemo(() => packBubbles(filteredTopics, dimensions.width, dimensions.height), [filteredTopics, dimensions]);

  const handleBubbleClick = useCallback((topic: TopicBubble) => {
    setSelectedTopic((previous) => (previous?.id === topic.id ? null : topic));
  }, []);

  const handleBubbleHover = useCallback((event: React.MouseEvent<SVGCircleElement>, topic: TopicBubble) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;

    setHoveredId(topic.id);
    setHoveredTopic({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top - 12,
      topic,
    });
  }, []);

  const handleBubbleLeave = useCallback(() => {
    setHoveredId(null);
    setHoveredTopic(null);
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="min-w-0">
      <Card className={surfaceCardClassName}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className={`text-base font-semibold ${titleTextClassName}`}>Skill Map</h3>
            {data.topics.length > 0 ? (
              <p className={`mt-1 text-xs ${mutedTextClassName}`}>
                Strongest: <span className="font-semibold text-emerald-600 dark:text-emerald-300">{data.strongestTopic}</span>
                {' | '}
                Focus area: <span className="font-semibold text-amber-600 dark:text-amber-300">{data.weakestTopic}</span>
              </p>
            ) : (
              <p className={`mt-1 text-xs ${mutedTextClassName}`}>
                Complete quizzes or solve problems to build your live skill map.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {Object.entries(PROFICIENCY_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: PROFICIENCY_COLORS[key] }} />
                <span className={`text-xs ${mutedTextClassName}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setCategoryFilter(category);
                setSelectedTopic(null);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                categoryFilter === category
                  ? 'border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300'
                  : `${pillClassName} ${mutedTextClassName}`
              }`}
            >
              {category === 'all' ? 'All Topics' : category}
            </button>
          ))}
        </div>

        <div
          ref={containerRef}
          className={`relative overflow-hidden rounded-2xl border p-3 ${panelClassName}`}
          style={{
            background: isDark
              ? 'linear-gradient(180deg, rgba(2,6,23,0.28), rgba(2,6,23,0.18))'
              : 'linear-gradient(180deg, rgba(226,232,240,0.92), rgba(241,245,249,0.98))',
          }}
        >
          {filteredTopics.length === 0 && (
            <div className={`absolute inset-0 flex items-center justify-center px-6 text-center text-sm ${mutedTextClassName}`}>
              No topic activity has been recorded for this view yet.
            </div>
          )}

          <svg width={dimensions.width} height={dimensions.height}>
            <defs>
              {bubbles.map((bubble) => (
                <radialGradient key={`gradient-${bubble.topic.id}`} id={`bubbleGrad-${bubble.topic.id}`}>
                  <stop
                    offset="0%"
                    stopColor={PROFICIENCY_COLORS[bubble.topic.proficiencyLevel]}
                    stopOpacity={isDark ? '0.32' : '0.72'}
                  />
                  <stop
                    offset="72%"
                    stopColor={PROFICIENCY_COLORS[bubble.topic.proficiencyLevel]}
                    stopOpacity={isDark ? '0.14' : '0.34'}
                  />
                  <stop
                    offset="100%"
                    stopColor={PROFICIENCY_COLORS[bubble.topic.proficiencyLevel]}
                    stopOpacity={isDark ? '0.04' : '0.12'}
                  />
                </radialGradient>
              ))}
              {bubbles.map((bubble) => {
                const outerRadius = bubble.r + 6;
                return (
                  <clipPath key={`clip-${bubble.topic.id}`} id={`bubbleClip-${bubble.topic.id}`} clipPathUnits="userSpaceOnUse">
                    <circle cx={bubble.x} cy={bubble.y} r={Math.max(0, outerRadius - TEXT_INSET)} />
                  </clipPath>
                );
              })}
            </defs>

            {bubbles.map((bubble, index) => {
              const isHovered = hoveredId === bubble.topic.id;
              const isSelected = selectedTopic?.id === bubble.topic.id;
              const proficiencyColor = PROFICIENCY_COLORS[bubble.topic.proficiencyLevel];
              const labelLayout = getBubbleLabelLayout(bubble.topic.name, bubble.r + 6);

              return (
                <g key={bubble.topic.id}>
                  <motion.circle
                    cx={bubble.x}
                    cy={bubble.y}
                    r={bubble.r + 6}
                    fill="none"
                    stroke={proficiencyColor}
                    strokeWidth={isSelected ? 2 : 0}
                    strokeOpacity={0.35}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isHovered || isSelected ? 1 : 0 }}
                    transition={{ duration: 0.25 }}
                  />

                  <motion.circle
                    cx={bubble.x}
                    cy={bubble.y}
                    fill={`url(#bubbleGrad-${bubble.topic.id})`}
                    stroke={proficiencyColor}
                    strokeWidth={isHovered || isSelected ? 2.2 : 1.1}
                    strokeOpacity={isHovered || isSelected ? (isDark ? 0.75 : 0.92) : isDark ? 0.3 : 0.58}
                    className="cursor-pointer"
                    initial={{ r: 0, opacity: 0 }}
                    animate={{
                      r: isHovered ? bubble.r * 1.03 : bubble.r,
                      opacity: 1,
                    }}
                    transition={{
                      r: { duration: 0.7, delay: index * 0.03, type: 'spring', stiffness: 220, damping: 16 },
                      opacity: { duration: 0.45, delay: index * 0.03 },
                    }}
                    onMouseEnter={(event) => handleBubbleHover(event, bubble.topic)}
                    onMouseMove={(event) => handleBubbleHover(event, bubble.topic)}
                    onMouseLeave={handleBubbleLeave}
                    onClick={() => handleBubbleClick(bubble.topic)}
                    style={{
                      filter: isHovered
                        ? `drop-shadow(0 0 18px ${proficiencyColor}${isDark ? '55' : '40'})`
                        : `drop-shadow(0 10px 20px ${proficiencyColor}${isDark ? '12' : '18'})`,
                    }}
                  >
                    <title>{bubble.topic.name}</title>
                  </motion.circle>

                  {labelLayout.lines.length > 0 && (
                    <g clipPath={`url(#bubbleClip-${bubble.topic.id})`} className="pointer-events-none select-none">
                      {labelLayout.lines.map((line, lineIndex) => (
                        <motion.text
                          key={`${bubble.topic.id}-${lineIndex}`}
                          x={bubble.x}
                          y={bubble.y + labelLayout.titleStartY + lineIndex * (labelLayout.fontSize * 0.92)}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={isDark ? '#f8fafc' : '#0f172a'}
                          fontSize={labelLayout.fontSize}
                          fontWeight="600"
                          clipPath={`url(#bubbleClip-${bubble.topic.id})`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 + 0.45 }}
                        >
                          {line}
                        </motion.text>
                      ))}

                      {labelLayout.showSubtitle && (
                        <motion.text
                          x={bubble.x}
                          y={bubble.y + labelLayout.subtitleY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={isDark ? 'rgba(248,250,252,0.62)' : 'rgba(15,23,42,0.72)'}
                          fontSize={labelLayout.subtitleSize}
                          clipPath={`url(#bubbleClip-${bubble.topic.id})`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 + 0.55 }}
                        >
                          {bubble.topic.problemsSolved} solved
                        </motion.text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          <AnimatePresence>
            {hoveredTopic && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="pointer-events-none absolute z-20 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-800/70 dark:bg-slate-950/95"
                style={{
                  left: hoveredTopic.x,
                  top: hoveredTopic.y,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className={`font-semibold ${titleTextClassName}`}>{hoveredTopic.topic.name}</div>
                <div className={`mt-1 ${mutedTextClassName}`}>
                  {hoveredTopic.topic.problemsSolved} solved | {Math.round(hoveredTopic.topic.timeSpentMinutes / 60)}h spent
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {selectedTopic && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div
                className={`rounded-2xl border p-4 ${panelClassName}`}
                style={{
                  borderColor: `${PROFICIENCY_COLORS[selectedTopic.proficiencyLevel]}26`,
                  background: `linear-gradient(135deg, ${PROFICIENCY_COLORS[selectedTopic.proficiencyLevel]}12, transparent)`,
                }}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h4 className={`flex items-center gap-2 text-base font-semibold ${titleTextClassName}`}>
                      {selectedTopic.name}
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          background: `${PROFICIENCY_COLORS[selectedTopic.proficiencyLevel]}18`,
                          color: PROFICIENCY_COLORS[selectedTopic.proficiencyLevel],
                        }}
                      >
                        {PROFICIENCY_LABELS[selectedTopic.proficiencyLevel]}
                      </span>
                    </h4>
                    <p className={`mt-0.5 text-xs ${mutedTextClassName}`}>Category: {selectedTopic.category}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTopic(null)}
                    className={`text-lg transition-colors ${mutedTextClassName} hover:text-slate-900 dark:hover:text-white`}
                  >
                    x
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className={`rounded-xl border p-3 text-center ${panelClassName}`}>
                    <div className={`text-lg font-bold ${titleTextClassName}`}>{selectedTopic.problemsSolved}</div>
                    <div className={`text-xs ${mutedTextClassName}`}>Solved</div>
                  </div>
                  <div className={`rounded-xl border p-3 text-center ${panelClassName}`}>
                    <div className={`text-lg font-bold ${titleTextClassName}`}>{Math.round(selectedTopic.timeSpentMinutes / 60)}h</div>
                    <div className={`text-xs ${mutedTextClassName}`}>Time Spent</div>
                  </div>
                  <div className={`rounded-xl border p-3 text-center ${panelClassName}`}>
                    <div className="text-lg font-bold" style={{ color: PROFICIENCY_COLORS[selectedTopic.proficiencyLevel] }}>
                      {selectedTopic.proficiencyScore}%
                    </div>
                    <div className={`text-xs ${mutedTextClassName}`}>Proficiency</div>
                  </div>
                  <div className={`rounded-xl border p-3 text-center ${panelClassName}`}>
                    <div className={`text-lg font-bold ${titleTextClassName}`}>
                      {Math.round(
                        (selectedTopic.problemsSolved / Math.max(1, selectedTopic.timeSpentMinutes / 60)) * 10,
                      ) / 10}
                    </div>
                    <div className={`text-xs ${mutedTextClassName}`}>Solved / hr</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className={`mb-1 flex items-center justify-between text-xs ${mutedTextClassName}`}>
                    <span>Proficiency Score</span>
                    <span style={{ color: PROFICIENCY_COLORS[selectedTopic.proficiencyLevel] }} className="font-semibold">
                      {selectedTopic.proficiencyScore}/100
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
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
      </Card>
    </motion.div>
  );
});

export default TopicBubbleMap;
