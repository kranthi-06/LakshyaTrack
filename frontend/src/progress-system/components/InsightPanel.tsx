import { memo, useMemo } from 'react';
import { AlertTriangle, Brain, Lightbulb, Radio, ShieldCheck, TrendingUp } from 'lucide-react';
import type { IntelligenceData, ActivitySummary } from '../types';
import type { ProgressStreamMessage } from '../services/progressApi';
import type { DashboardSection, DetailLevel } from './Sidebar';

interface InsightPanelProps {
  intelligence: IntelligenceData;
  activity: ActivitySummary;
  streamMessages: ProgressStreamMessage[];
  detailLevel: DetailLevel;
  activeSection: DashboardSection;
  selectedBubbleLabel?: string;
  statusLabel: string;
}

function InsightPanel({
  intelligence,
  activity,
  streamMessages,
  detailLevel,
  activeSection,
  selectedBubbleLabel,
  statusLabel,
}: InsightPanelProps) {
  const anomalyItems = useMemo(() => {
    const items: { title: string; description: string }[] = [];

    if (intelligence.predictedStreakBreak) {
      items.push({
        title: 'Consistency risk',
        description: 'The model sees a streak interruption risk in the current usage pattern.',
      });
    }

    if (activity.totalIdleTime > activity.totalActiveTime) {
      items.push({
        title: 'Idle time is high',
        description: 'Idle time is outpacing active engagement. Tighten session focus.',
      });
    }

    if (intelligence.growthRate > 0) {
      items.push({
        title: 'Growth trend is positive',
        description: `Engagement is up ${intelligence.growthRate.toFixed(1)}% versus the previous baseline.`,
      });
    }

    return items.slice(0, detailLevel === 'deep' ? 4 : 3);
  }, [activity.totalActiveTime, activity.totalIdleTime, detailLevel, intelligence.growthRate, intelligence.predictedStreakBreak]);

  const liveStreamSummary = streamMessages.slice(0, 4);

  return (
    <aside className="pi-surface rounded-[28px] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--pi-text-soft)]">
            AI Insight Rail
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--pi-text)]">Adaptive guidance</div>
          <div className="mt-1 text-sm text-[var(--pi-text-soft)]">
            Context-aware suggestions for {activeSection === 'overview' ? 'the whole workspace' : activeSection}.
          </div>
        </div>

        <div className="rounded-full border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--pi-text-soft)]">
          {statusLabel}
        </div>
      </div>

      <div className="pi-scroll mt-5 space-y-4 overflow-y-auto 2xl:max-h-[calc(100vh-14rem)]">
        <div className="rounded-[24px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--pi-text)]">
            <Brain className="h-4 w-4 text-[var(--pi-accent)]" />
            Priority insights
          </div>

          <div className="mt-3 space-y-3">
            {intelligence.insights.slice(0, detailLevel === 'deep' ? 6 : 4).map((insight) => (
              <div
                key={insight.id}
                className="rounded-[20px] border border-[var(--pi-border)] bg-[var(--pi-surface)] p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--pi-accent-soft)] text-[var(--pi-accent)]">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--pi-text)]">{insight.title}</div>
                    <div className="mt-1 text-xs text-[var(--pi-text-soft)]">{insight.description}</div>
                  </div>
                </div>
              </div>
            ))}

            {intelligence.insights.length === 0 && (
              <div className="rounded-[20px] border border-dashed border-[var(--pi-border)] bg-[var(--pi-surface)] p-3 text-xs text-[var(--pi-text-soft)]">
                Insights will populate automatically as the analytics engine gathers more event history.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--pi-text)]">
            <AlertTriangle className="h-4 w-4 text-[var(--pi-warning)]" />
            Anomaly detection
          </div>

          <div className="mt-3 space-y-3">
            {anomalyItems.length > 0 ? anomalyItems.map((item) => (
              <div key={item.title} className="rounded-[18px] border border-[var(--pi-border)] bg-[var(--pi-surface)] p-3">
                <div className="text-sm font-semibold text-[var(--pi-text)]">{item.title}</div>
                <div className="mt-1 text-xs text-[var(--pi-text-soft)]">{item.description}</div>
              </div>
            )) : (
              <div className="rounded-[18px] border border-dashed border-[var(--pi-border)] bg-[var(--pi-surface)] p-3 text-xs text-[var(--pi-text-soft)]">
                No anomalies detected. The usage profile looks stable right now.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--pi-text)]">
            <TrendingUp className="h-4 w-4 text-[var(--pi-secondary)]" />
            Suggested focus
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(intelligence.suggestedFocusAreas.length > 0
              ? intelligence.suggestedFocusAreas
              : ['Realtime engagement', 'Session quality', 'Feature adoption']
            ).map((area) => (
              <span
                key={area}
                className="rounded-full border border-[var(--pi-border)] bg-[var(--pi-surface)] px-3 py-1.5 text-xs text-[var(--pi-text-soft)]"
              >
                {area}
              </span>
            ))}
          </div>

          {selectedBubbleLabel && (
            <div className="mt-4 rounded-[18px] border border-[var(--pi-border)] bg-[var(--pi-surface)] p-3 text-xs text-[var(--pi-text-soft)]">
              Deep analysis is currently centered on <span className="font-semibold text-[var(--pi-text)]">{selectedBubbleLabel}</span>.
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--pi-text)]">
            <Radio className="h-4 w-4 text-[var(--pi-success)]" />
            Stream health
          </div>

          <div className="mt-3 space-y-3">
            {liveStreamSummary.map((message, index) => (
              <div key={`${message.timestamp || index}-${index}`} className="rounded-[18px] border border-[var(--pi-border)] bg-[var(--pi-surface)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--pi-text-soft)]">
                  {message.kind || 'stream'}
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--pi-text)]">
                  {(message.eventTypes || []).slice(0, 3).join(', ') || 'Live transport heartbeat'}
                </div>
                <div className="mt-1 text-xs text-[var(--pi-text-soft)]">
                  {message.eventCount ? `${message.eventCount} events processed` : 'Pipeline heartbeat'}
                </div>
              </div>
            ))}

            {liveStreamSummary.length === 0 && (
              <div className="rounded-[18px] border border-dashed border-[var(--pi-border)] bg-[var(--pi-surface)] p-3 text-xs text-[var(--pi-text-soft)]">
                Live transport updates will appear here once the stream starts emitting changes.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--pi-text)]">
            <ShieldCheck className="h-4 w-4 text-[var(--pi-success)]" />
            Reliability
          </div>
          <div className="mt-3 text-xs leading-6 text-[var(--pi-text-soft)]">
            The dashboard prefers the authenticated realtime stream and falls back to resilient refresh behavior when the stream degrades, keeping analytics visible without tearing the layout.
          </div>
        </div>
      </div>
    </aside>
  );
}

export default memo(InsightPanel);
