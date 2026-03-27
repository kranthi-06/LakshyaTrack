import { useEffect } from 'react';
import { create } from 'zustand';
import { PROGRESS_UPDATE_EVENT } from '../services/eventTracker';
import {
  fetchActivity,
  fetchBadges,
  fetchContributions,
  fetchDashboard,
  fetchIntelligence,
  getCachedDashboardSnapshot,
  invalidateCache as invalidateProgressApiCache,
  fetchProblemStats,
  fetchStreak,
  fetchTimeAnalytics,
  fetchTopicMap,
  getProgressDashboardData,
  subscribeToProgressUpdates,
  type ProgressStreamMessage,
} from '../services/progressApi';
import type {
  ActivitySummary,
  BadgeSystemData,
  ContributionData,
  IntelligenceData,
  ProblemSolvingStats,
  ProgressDashboardData,
  StreakData,
  TimeAnalyticsData,
  TopicMapData,
} from '../types';

export type DashboardSection = Exclude<keyof ProgressDashboardData, 'lastUpdated'>;

type DashboardSectionDataMap = {
  contributions: ContributionData;
  problemSolving: ProblemSolvingStats;
  activity: ActivitySummary;
  timeAnalytics: TimeAnalyticsData;
  topicMap: TopicMapData;
  streak: StreakData;
  badges: BadgeSystemData;
  intelligence: IntelligenceData;
};

type LoadedSectionsState = Record<DashboardSection, boolean>;

interface RefreshOptions {
  forceRefresh?: boolean;
  showLoading?: boolean;
  fallbackToMock?: boolean;
  reason?: string;
}

interface SectionRefreshOptions {
  forceRefresh?: boolean;
  fallbackToMock?: boolean;
  timestamp?: string;
}

interface ProgressDashboardStoreState {
  data: ProgressDashboardData;
  isLoading: boolean;
  isRefreshing: boolean;
  isLive: boolean;
  isOnline: boolean;
  hasHydrated: boolean;
  loadedSections: LoadedSectionsState;
  selectedContributionYear: number;
  lastFetchAt: number;
  refreshDashboard: (options?: RefreshOptions) => Promise<void>;
  refreshContributionYear: (year: number) => Promise<void>;
  setLiveStatus: (isLive: boolean) => void;
  setOnlineStatus: (isOnline: boolean) => void;
}

const ALL_SECTIONS: DashboardSection[] = [
  'contributions',
  'problemSolving',
  'activity',
  'timeAnalytics',
  'topicMap',
  'streak',
  'badges',
  'intelligence',
];

const initialDashboardSnapshot = getCachedDashboardSnapshot();

const FALLBACK_POLL_INTERVAL_MS = 20_000;
const STALE_REFRESH_MS = 15_000;
const SECTION_REFRESH_DEBOUNCE_MS = 350;
const LOCAL_EVENT_DELAY_MS = 1_200;

const EVENT_SECTION_MAP: Record<string, DashboardSection[]> = {
  PAGE_VISIT: ['activity', 'timeAnalytics', 'intelligence', 'contributions'],
  FEATURE_USED: ['activity', 'timeAnalytics', 'intelligence', 'contributions'],
  SESSION_START: ['activity', 'timeAnalytics', 'intelligence', 'contributions', 'streak'],
  SESSION_END: ['activity', 'timeAnalytics', 'intelligence', 'contributions', 'streak'],
  ACTIVE: ['activity', 'timeAnalytics', 'intelligence'],
  IDLE: ['activity', 'timeAnalytics', 'intelligence'],
  PROBLEM_SOLVED: ['problemSolving', 'topicMap', 'badges', 'intelligence', 'contributions', 'streak', 'activity', 'timeAnalytics'],
  QUIZ_COMPLETED: ['badges', 'intelligence', 'activity', 'timeAnalytics', 'contributions', 'streak'],
  INTERVIEW_COMPLETED: ['badges', 'intelligence', 'activity', 'timeAnalytics', 'contributions'],
  RESUME_ANALYZED: ['badges', 'intelligence', 'activity', 'timeAnalytics', 'contributions'],
  ROADMAP_GENERATED: ['badges', 'intelligence', 'activity', 'timeAnalytics', 'contributions'],
  CODE_EXECUTED: ['activity', 'timeAnalytics', 'intelligence', 'contributions'],
};

const isEqualValue = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function isStale(lastFetchAt: number, thresholdMs = STALE_REFRESH_MS): boolean {
  return lastFetchAt === 0 || Date.now() - lastFetchAt >= thresholdMs;
}

function getRequestedSections(sections: DashboardSection[]): DashboardSection[] {
  const unique = new Set(sections);
  const selectedYear = useProgressDashboardStore.getState().selectedContributionYear;

  if (selectedYear !== getCurrentYear()) {
    unique.delete('contributions');
  }

  return Array.from(unique);
}

function buildLoadedSectionsState(value = false): LoadedSectionsState {
  return {
    contributions: value,
    problemSolving: value,
    activity: value,
    timeAnalytics: value,
    topicMap: value,
    streak: value,
    badges: value,
    intelligence: value,
  };
}

function mergeLoadedSectionsState(
  current: LoadedSectionsState,
  sections: DashboardSection[],
): LoadedSectionsState {
  if (sections.length === 0) {
    return current;
  }

  const nextState = { ...current };
  sections.forEach((section) => {
    nextState[section] = true;
  });
  return nextState;
}

function mergeDashboardPatch(
  current: ProgressDashboardData,
  patch: Partial<DashboardSectionDataMap>,
  timestamp = new Date().toISOString(),
): ProgressDashboardData {
  let changed = false;
  const nextData = { ...current };

  for (const section of Object.keys(patch) as DashboardSection[]) {
    const incomingValue = patch[section];
    if (incomingValue === undefined) {
      continue;
    }

    if (isEqualValue(current[section], incomingValue)) {
      nextData[section] = current[section];
      continue;
    }

    nextData[section] = incomingValue as never;
    changed = true;
  }

  if (!changed) {
    return current;
  }

  nextData.lastUpdated = timestamp;
  return nextData;
}

async function fetchSectionData(
  sections: DashboardSection[],
  forceRefresh = true,
  fallbackToMock = false,
): Promise<Partial<DashboardSectionDataMap>> {
  const requestedSections = getRequestedSections(sections);
  if (requestedSections.length === 0) {
    return {};
  }

  const selectedContributionYear = useProgressDashboardStore.getState().selectedContributionYear;
  const tasks: Record<DashboardSection, (() => Promise<DashboardSectionDataMap[DashboardSection]>)> = {
    contributions: () => fetchContributions(selectedContributionYear, forceRefresh, fallbackToMock),
    problemSolving: () => fetchProblemStats(forceRefresh, fallbackToMock),
    activity: () => fetchActivity(forceRefresh, fallbackToMock),
    timeAnalytics: () => fetchTimeAnalytics(forceRefresh, fallbackToMock),
    topicMap: () => fetchTopicMap(forceRefresh, fallbackToMock),
    streak: () => fetchStreak(forceRefresh, fallbackToMock),
    badges: () => fetchBadges(forceRefresh, fallbackToMock),
    intelligence: () => fetchIntelligence(forceRefresh, fallbackToMock),
  };

  const results = await Promise.allSettled(
    requestedSections.map(async (section) => ({ section, value: await tasks[section]() })),
  );

  return results.reduce<Partial<DashboardSectionDataMap>>((patch, result) => {
    if (result.status === 'fulfilled') {
      patch[result.value.section] = result.value.value;
    }
    return patch;
  }, {});
}

export const useProgressDashboardStore = create<ProgressDashboardStoreState>(() => ({
  data: initialDashboardSnapshot?.data ?? getProgressDashboardData(),
  isLoading: !initialDashboardSnapshot,
  isRefreshing: false,
  isLive: false,
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  hasHydrated: Boolean(initialDashboardSnapshot),
  loadedSections: buildLoadedSectionsState(Boolean(initialDashboardSnapshot)),
  selectedContributionYear: getCurrentYear(),
  lastFetchAt: initialDashboardSnapshot?.fetchedAt ?? 0,
  refreshDashboard: (options) => performFullRefresh(options),
  refreshContributionYear: (year) => performContributionYearRefresh(year),
  setLiveStatus: (isLive) => useProgressDashboardStore.setState({ isLive }),
  setOnlineStatus: (isOnline) => useProgressDashboardStore.setState({ isOnline }),
}));

let runtimeRefCount = 0;
let runtimeStarted = false;
let fullRefreshPromise: Promise<void> | null = null;
let sectionRefreshPromise: Promise<void> | null = null;
const pendingSectionRefresh = new Set<DashboardSection>();
let pendingSectionTimestamp: string | undefined;
let pendingSectionTimer: number | null = null;
let fallbackPollId: number | null = null;
let localEventTimer: number | null = null;
let disconnectStream: (() => void) | null = null;
let windowFocusHandler: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let onlineHandler: (() => void) | null = null;
let offlineHandler: (() => void) | null = null;
let customProgressHandler: EventListener | null = null;

export function resetProgressDashboardStoreState(): void {
  fullRefreshPromise = null;
  sectionRefreshPromise = null;
  pendingSectionRefresh.clear();
  pendingSectionTimestamp = undefined;

  if (pendingSectionTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(pendingSectionTimer);
    pendingSectionTimer = null;
  }

  invalidateProgressApiCache();

  useProgressDashboardStore.setState({
    data: getProgressDashboardData(true),
    isLoading: true,
    isRefreshing: false,
    isLive: false,
    isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    hasHydrated: false,
    loadedSections: buildLoadedSectionsState(false),
    selectedContributionYear: getCurrentYear(),
    lastFetchAt: 0,
  });
}

async function performFullRefresh(options: RefreshOptions = {}): Promise<void> {
  const state = useProgressDashboardStore.getState();
  const forceRefresh = options.forceRefresh ?? false;
  const showLoading = options.showLoading ?? !state.hasHydrated;
  const fallbackToMock = options.fallbackToMock ?? !state.hasHydrated;

  if (fullRefreshPromise) {
    return fullRefreshPromise;
  }

  if (!forceRefresh && state.hasHydrated && !isStale(state.lastFetchAt)) {
    return;
  }

  useProgressDashboardStore.setState({
    isRefreshing: true,
    ...(showLoading ? { isLoading: true } : {}),
  });

  fullRefreshPromise = (async () => {
    try {
      const freshData = await fetchDashboard(forceRefresh, fallbackToMock);
      useProgressDashboardStore.setState((current) => ({
        data: mergeDashboardPatch(
          current.data,
          {
            contributions: freshData.contributions,
            problemSolving: freshData.problemSolving,
            activity: freshData.activity,
            timeAnalytics: freshData.timeAnalytics,
            topicMap: freshData.topicMap,
            streak: freshData.streak,
            badges: freshData.badges,
            intelligence: freshData.intelligence,
          },
          freshData.lastUpdated,
        ),
        hasHydrated: true,
        loadedSections: buildLoadedSectionsState(true),
        lastFetchAt: Date.now(),
      }));
    } catch {
      if (!useProgressDashboardStore.getState().hasHydrated && fallbackToMock) {
        useProgressDashboardStore.setState({
          data: getProgressDashboardData(true),
          hasHydrated: true,
          loadedSections: buildLoadedSectionsState(true),
          lastFetchAt: Date.now(),
        });
      }
    } finally {
      useProgressDashboardStore.setState({
        isRefreshing: false,
        isLoading: false,
      });
      fullRefreshPromise = null;
    }
  })();

  return fullRefreshPromise;
}

async function refreshSectionsNow(
  sections: DashboardSection[],
  options: SectionRefreshOptions = {},
): Promise<void> {
  const requestedSections = getRequestedSections(sections);
  if (requestedSections.length === 0) {
    return;
  }

  if (fullRefreshPromise) {
    await fullRefreshPromise;
    return;
  }

  if (sectionRefreshPromise) {
    requestedSections.forEach((section) => pendingSectionRefresh.add(section));
    if (options.timestamp) {
      pendingSectionTimestamp = options.timestamp;
    }
    return;
  }

  useProgressDashboardStore.setState({ isRefreshing: true });

  sectionRefreshPromise = (async () => {
    try {
      const patch = await fetchSectionData(
        requestedSections,
        options.forceRefresh ?? true,
        options.fallbackToMock ?? false,
      );

      if (Object.keys(patch).length > 0) {
        const resolvedSections = Object.keys(patch) as DashboardSection[];
        useProgressDashboardStore.setState((current) => ({
          data: mergeDashboardPatch(current.data, patch, options.timestamp),
          hasHydrated: true,
          loadedSections: mergeLoadedSectionsState(current.loadedSections, resolvedSections),
          lastFetchAt: Date.now(),
        }));
      }
    } finally {
      sectionRefreshPromise = null;
      const hasQueuedRefresh = pendingSectionRefresh.size > 0;
      const queuedSections = Array.from(pendingSectionRefresh);
      const queuedTimestamp = pendingSectionTimestamp;
      pendingSectionRefresh.clear();
      pendingSectionTimestamp = undefined;

      if (hasQueuedRefresh) {
        void refreshSectionsNow(queuedSections, {
          forceRefresh: true,
          fallbackToMock: false,
          timestamp: queuedTimestamp,
        });
      } else {
        useProgressDashboardStore.setState({ isRefreshing: false });
      }
    }
  })();

  return sectionRefreshPromise;
}

async function performContributionYearRefresh(year: number): Promise<void> {
  useProgressDashboardStore.setState({ selectedContributionYear: year, isRefreshing: true });

  try {
    const contributions = await fetchContributions(year, true, false);
    useProgressDashboardStore.setState((current) => ({
      data: mergeDashboardPatch(current.data, { contributions }),
      loadedSections: mergeLoadedSectionsState(current.loadedSections, ['contributions']),
      lastFetchAt: Date.now(),
    }));
  } finally {
    useProgressDashboardStore.setState({ isRefreshing: false });
  }
}

function scheduleSectionRefresh(sections: DashboardSection[], timestamp?: string, delayMs = SECTION_REFRESH_DEBOUNCE_MS): void {
  const requestedSections = getRequestedSections(sections);
  if (requestedSections.length === 0 || typeof window === 'undefined') {
    return;
  }

  requestedSections.forEach((section) => pendingSectionRefresh.add(section));
  if (timestamp) {
    pendingSectionTimestamp = timestamp;
  }

  if (pendingSectionTimer !== null) {
    window.clearTimeout(pendingSectionTimer);
  }

  pendingSectionTimer = window.setTimeout(() => {
    pendingSectionTimer = null;
    const sectionsToRefresh = Array.from(pendingSectionRefresh);
    const refreshTimestamp = pendingSectionTimestamp;
    pendingSectionRefresh.clear();
    pendingSectionTimestamp = undefined;
    void refreshSectionsNow(sectionsToRefresh, {
      forceRefresh: true,
      fallbackToMock: false,
      timestamp: refreshTimestamp,
    });
  }, delayMs);
}

function getSectionsForEventTypes(eventTypes: string[]): DashboardSection[] {
  const sections = new Set<DashboardSection>();

  for (const rawEventType of eventTypes) {
    const eventType = rawEventType.toUpperCase();
    const mappedSections = EVENT_SECTION_MAP[eventType];
    if (!mappedSections) {
      return [...ALL_SECTIONS];
    }

    mappedSections.forEach((section) => sections.add(section));
  }

  return sections.size > 0 ? Array.from(sections) : ['activity', 'timeAnalytics', 'intelligence'];
}

function getSectionsForStreamMessage(message: ProgressStreamMessage): DashboardSection[] {
  switch (message.kind) {
    case 'progress_updated':
      return getSectionsForEventTypes(message.eventTypes ?? []);
    case 'streak_updated':
      return ['streak', 'contributions', 'intelligence', 'activity'];
    case 'buffer_flushed':
    case 'aggregate_updated':
      return [...ALL_SECTIONS];
    default:
      return [...ALL_SECTIONS];
  }
}

function ensureFallbackPolling(): void {
  if (typeof window === 'undefined' || fallbackPollId !== null) {
    return;
  }

  fallbackPollId = window.setInterval(() => {
    const state = useProgressDashboardStore.getState();
    if (!navigator.onLine || document.hidden || state.isLive) {
      return;
    }

    if (isStale(state.lastFetchAt)) {
      void performFullRefresh({
        forceRefresh: true,
        showLoading: false,
        fallbackToMock: false,
        reason: 'fallback-poll',
      });
    }
  }, FALLBACK_POLL_INTERVAL_MS);
}

function tearDownRuntime(): void {
  if (disconnectStream) {
    disconnectStream();
    disconnectStream = null;
  }

  if (fallbackPollId !== null) {
    window.clearInterval(fallbackPollId);
    fallbackPollId = null;
  }

  if (pendingSectionTimer !== null) {
    window.clearTimeout(pendingSectionTimer);
    pendingSectionTimer = null;
  }

  if (localEventTimer !== null) {
    window.clearTimeout(localEventTimer);
    localEventTimer = null;
  }

  if (customProgressHandler) {
    window.removeEventListener(PROGRESS_UPDATE_EVENT, customProgressHandler);
    customProgressHandler = null;
  }

  if (windowFocusHandler) {
    window.removeEventListener('focus', windowFocusHandler);
    windowFocusHandler = null;
  }

  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }

  if (offlineHandler) {
    window.removeEventListener('offline', offlineHandler);
    offlineHandler = null;
  }

  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }

  pendingSectionRefresh.clear();
  pendingSectionTimestamp = undefined;
  useProgressDashboardStore.setState({ isLive: false, isRefreshing: false });
  runtimeStarted = false;
}

function startRuntime(): void {
  if (runtimeStarted || typeof window === 'undefined') {
    return;
  }

  runtimeStarted = true;
  ensureFallbackPolling();

  let state = useProgressDashboardStore.getState();
  if (!state.hasHydrated) {
    const cachedSnapshot = getCachedDashboardSnapshot();
    if (cachedSnapshot) {
      useProgressDashboardStore.setState({
        data: cachedSnapshot.data,
        isLoading: false,
        hasHydrated: true,
        loadedSections: buildLoadedSectionsState(true),
        lastFetchAt: cachedSnapshot.fetchedAt,
      });
      state = useProgressDashboardStore.getState();
    }
  }

  if (!state.hasHydrated) {
    void performFullRefresh({
      showLoading: true,
      forceRefresh: false,
      fallbackToMock: true,
      reason: 'initial-load',
    });
  } else if (isStale(state.lastFetchAt)) {
    void performFullRefresh({
      showLoading: false,
      forceRefresh: true,
      fallbackToMock: false,
      reason: 'stale-mount',
    });
  }

  disconnectStream = subscribeToProgressUpdates({
    onOpen: () => {
      useProgressDashboardStore.setState({ isLive: true });
      if (isStale(useProgressDashboardStore.getState().lastFetchAt, 5_000)) {
        void performFullRefresh({
          showLoading: false,
          forceRefresh: true,
          fallbackToMock: false,
          reason: 'stream-ready',
        });
      }
    },
    onMessage: (message) => {
      useProgressDashboardStore.setState({ isLive: true });
      const sections = getSectionsForStreamMessage(message);
      scheduleSectionRefresh(sections, message.timestamp);
    },
    onError: () => {
      useProgressDashboardStore.setState({ isLive: false });
    },
  });

  customProgressHandler = ((event: Event) => {
    if (useProgressDashboardStore.getState().isLive) {
      return;
    }

    const customEvent = event as CustomEvent<{ reason?: string; timestamp?: number }>;
    const reason = customEvent.detail?.reason;
    const sections = typeof reason === 'string' ? getSectionsForEventTypes([reason]) : ['activity', 'timeAnalytics', 'intelligence'];

    if (localEventTimer !== null) {
      window.clearTimeout(localEventTimer);
    }

    localEventTimer = window.setTimeout(() => {
      scheduleSectionRefresh(sections, new Date(customEvent.detail?.timestamp ?? Date.now()).toISOString(), 0);
    }, LOCAL_EVENT_DELAY_MS);
  }) as EventListener;

  windowFocusHandler = () => {
    if (isStale(useProgressDashboardStore.getState().lastFetchAt)) {
      void performFullRefresh({
        showLoading: false,
        forceRefresh: true,
        fallbackToMock: false,
        reason: 'window-focus',
      });
    }
  };

  visibilityHandler = () => {
    if (!document.hidden && isStale(useProgressDashboardStore.getState().lastFetchAt)) {
      void performFullRefresh({
        showLoading: false,
        forceRefresh: true,
        fallbackToMock: false,
        reason: 'visibility-return',
      });
    }
  };

  onlineHandler = () => {
    useProgressDashboardStore.setState({ isOnline: true });
    void performFullRefresh({
      showLoading: false,
      forceRefresh: true,
      fallbackToMock: false,
      reason: 'online',
    });
  };

  offlineHandler = () => {
    useProgressDashboardStore.setState({ isOnline: false, isLive: false });
  };

  window.addEventListener(PROGRESS_UPDATE_EVENT, customProgressHandler);
  window.addEventListener('focus', windowFocusHandler);
  window.addEventListener('online', onlineHandler);
  window.addEventListener('offline', offlineHandler);
  document.addEventListener('visibilitychange', visibilityHandler);
}

export function useProgressDashboardRuntime(): void {
  useEffect(() => {
    runtimeRefCount += 1;
    startRuntime();

    return () => {
      runtimeRefCount = Math.max(0, runtimeRefCount - 1);
      if (runtimeRefCount === 0) {
        tearDownRuntime();
      }
    };
  }, []);
}
