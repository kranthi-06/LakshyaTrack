import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { AnimatedNumber } from '../ui/AnimatedNumber';

export interface SummaryStatItem {
  label: string;
  value: string;
  numericValue: number;
  sub: string;
  accent: string;
  icon: string;
}

export interface SummaryCardProps {
  stat: SummaryStatItem;
  index: number;
  loaded: boolean;
  surfaceClassName: string;
  surfaceHoverClassName: string;
  skeleton: ReactNode;
}

export function SummaryCard({
  stat,
  index,
  loaded,
  surfaceClassName,
  surfaceHoverClassName,
  skeleton,
}: SummaryCardProps) {
  if (!loaded) {
    return <>{skeleton}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      whileHover={{ y: -2 }}
      className="min-w-0"
    >
      <Card className={`rounded-2xl p-5 ${surfaceClassName} ${surfaceHoverClassName}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {stat.label}
            </div>
            <div className="mt-2 flex items-end gap-2">
              <AnimatedNumber
                value={stat.numericValue}
                className="text-4xl font-[900] tracking-tighter text-slate-900 dark:text-white"
              />
              <div className="pb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{stat.sub}</div>
            </div>
          </div>
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl border"
            style={{
              background: `${stat.accent}12`,
              borderColor: `${stat.accent}22`,
            }}
          >
            {stat.icon}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
