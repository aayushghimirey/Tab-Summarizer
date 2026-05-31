interface TrackerState {
  activeDomain: string | null;
  startTime: number;
}

const IDLE_THRESHOLD = 60; // 1 minute

chrome.idle.setDetectionInterval(IDLE_THRESHOLD);

function getDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      return urlObj.hostname;
    }
  } catch (e) {
    // Ignore invalid URLs
  }
  return null;
}

/** Returns today's date as "YYYY-MM-DD" in local time */
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Resets timeMap if it's a new day */
async function checkAndResetForNewDay(): Promise<void> {
  const result = await chrome.storage.local.get(['lastDate']);
  const today = todayString();

  if (result.lastDate !== today) {
    console.log(`New day detected (${result.lastDate} → ${today}). Resetting timeMap.`);
    await chrome.storage.local.set({
      timeMap: {},
      lastDate: today,
      trackerState: { activeDomain: null, startTime: Date.now() }
    });
  }
}

async function updateTime(newDomain: string | null) {
  // Always check for a new day before recording time
  await checkAndResetForNewDay();

  const result = await chrome.storage.local.get(['trackerState', 'timeMap', 'isPaused', 'stoppedDomains']);
  const trackerState = result.trackerState as TrackerState | undefined;
  const timeMap = (result.timeMap || {}) as Record<string, number>;
  const isPaused = !!result.isPaused;
  const stoppedDomains = (result.stoppedDomains || []) as string[];

  const now = Date.now();

  // If tracking was active, save the elapsed time
  if (trackerState && trackerState.activeDomain) {
    const timeSpent = now - trackerState.startTime;
    const domain = trackerState.activeDomain;
    
    // Save only if not paused and not blacklisted
    if (!isPaused && !stoppedDomains.includes(domain)) {
      timeMap[domain] = (timeMap[domain] || 0) + timeSpent;
      await chrome.storage.local.set({ timeMap });
    }
  }

  // Determine the next domain to track
  let domainToSet = newDomain;
  if (isPaused || (newDomain && stoppedDomains.includes(newDomain))) {
    domainToSet = null;
  }

  await chrome.storage.local.set({
    trackerState: {
      activeDomain: domainToSet,
      startTime: now
    }
  });
}

async function handleTabChange() {
  const result = await chrome.storage.local.get(['isPaused']);
  if (result.isPaused) {
    await updateTime(null);
    return;
  }

  const state = await chrome.idle.queryState(IDLE_THRESHOLD);
  if (state === 'active') {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const domain = tabs.length > 0 ? getDomain(tabs[0].url) : null;
    await updateTime(domain);
  } else {
    await updateTime(null);
  }
}

// Listen to storage changes to react instantly when popup changes pause/blacklist state
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local') {
    if (changes.isPaused || changes.stoppedDomains) {
      await handleTabChange();
    }
  }
});

// On extension startup, initialise lastDate if missing
chrome.runtime.onStartup.addListener(async () => {
  await checkAndResetForNewDay();
});

chrome.runtime.onInstalled.addListener(async () => {
  await checkAndResetForNewDay();
});

chrome.tabs.onActivated.addListener(handleTabChange);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active) handleTabChange();
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await updateTime(null);
  } else {
    await handleTabChange();
  }
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === 'active') {
    await handleTabChange();
  } else {
    await updateTime(null);
  }
});
