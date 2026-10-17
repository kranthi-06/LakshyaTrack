import { describe, expect, it } from 'vitest';
import { packBubbles } from './topicBubbleLayout';
import type { TopicBubble } from '../types';

function topics(count: number): TopicBubble[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `topic-${index}`,
    name: `Topic ${index}`,
    category: 'Testing',
    problemsSolved: index,
    timeSpentMinutes: index * 10,
    proficiencyLevel: 'beginner',
    proficiencyScore: index,
    color: '#123456',
    size: index + 1,
  }));
}

describe('packBubbles', () => {
  it('keeps 1–40 circles bounded and collision-free', () => {
    for (let count = 1; count <= 40; count += 1) {
      const width = 600;
      const height = 420;
      const bubbles = packBubbles(topics(count), width, height);

      for (const bubble of bubbles) {
        expect(bubble.x - bubble.r).toBeGreaterThanOrEqual(0);
        expect(bubble.y - bubble.r).toBeGreaterThanOrEqual(0);
        expect(bubble.x + bubble.r).toBeLessThanOrEqual(width);
        expect(bubble.y + bubble.r).toBeLessThanOrEqual(height);
      }

      for (let first = 0; first < bubbles.length; first += 1) {
        for (let second = first + 1; second < bubbles.length; second += 1) {
          const left = bubbles[first];
          const right = bubbles[second];
          expect(Math.hypot(right.x - left.x, right.y - left.y)).toBeGreaterThanOrEqual(left.r + right.r);
        }
      }
    }
  });
});
