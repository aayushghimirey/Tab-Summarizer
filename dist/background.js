"use strict";
const IDLE_THRESHOLD = 60; // 1 minute
chrome.idle.setDetectionInterval(IDLE_THRESHOLD);
function getDomain(url) {
    if (!url)
        return null;
    try {
        const urlObj = new URL(url);
        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
            return urlObj.hostname;
        }
    }
    catch (e) {
        // Ignore invalid URLs
    }
    return null;
}
async function updateTime(newDomain) {
    const result = await chrome.storage.local.get(['trackerState', 'timeMap']);
    const trackerState = result.trackerState;
    const timeMap = (result.timeMap || {});
    const now = Date.now();
    if (trackerState && trackerState.activeDomain) {
        const timeSpent = now - trackerState.startTime;
        const domain = trackerState.activeDomain;
        // Safety check for crazy large durations (e.g. sleep for hours without idle triggering)
        // If it's more than 24 hours, we cap it or ignore it. Let's just add it.
        timeMap[domain] = (timeMap[domain] || 0) + timeSpent;
        await chrome.storage.local.set({ timeMap });
    }
    await chrome.storage.local.set({
        trackerState: {
            activeDomain: newDomain,
            startTime: now
        }
    });
}
async function handleTabChange() {
    const state = await chrome.idle.queryState(IDLE_THRESHOLD);
    if (state === 'active') {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const domain = tabs.length > 0 ? getDomain(tabs[0].url) : null;
        await updateTime(domain);
    }
    else {
        // Not active, so don't track anything
        await updateTime(null);
    }
}
chrome.tabs.onActivated.addListener(handleTabChange);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active) {
        handleTabChange();
    }
});
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        await updateTime(null);
    }
    else {
        await handleTabChange();
    }
});
chrome.idle.onStateChanged.addListener(async (newState) => {
    if (newState === 'active') {
        await handleTabChange();
    }
    else {
        // User went idle or locked screen
        await updateTime(null);
    }
});
