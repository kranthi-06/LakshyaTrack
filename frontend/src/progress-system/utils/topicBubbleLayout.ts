import type { TopicBubble } from '../types';

export interface BubblePosition {
  x: number;
  y: number;
  r: number;
  topic: TopicBubble;
}

export function packBubbles(topics: TopicBubble[], width: number, height: number): BubblePosition[] {
  if (topics.length === 0) return [];

  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const padding = Math.min(8, safeWidth / 4, safeHeight / 4);
  const innerWidth = Math.max(1, safeWidth - padding * 2);
  const innerHeight = Math.max(1, safeHeight - padding * 2);
  const columns = Math.ceil(Math.sqrt(topics.length * innerWidth / innerHeight));
  const rows = Math.ceil(topics.length / columns);
  const cellWidth = innerWidth / columns;
  const cellHeight = innerHeight / rows;
  const maxRadius = Math.max(1, Math.min(cellWidth, cellHeight) / 2 - 7);
  const maxSize = Math.max(1, ...topics.map((topic) => Math.max(0, topic.size)));
  const scale = maxRadius / Math.sqrt(maxSize);

  return topics.map((topic, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const radius = Math.min(
      maxRadius,
      Math.max(Math.min(6, maxRadius), Math.sqrt(Math.max(0, topic.size)) * scale),
    );

    return {
      x: padding + (column + 0.5) * cellWidth,
      y: padding + (row + 0.5) * cellHeight,
      r: radius,
      topic,
    };
  });
}
