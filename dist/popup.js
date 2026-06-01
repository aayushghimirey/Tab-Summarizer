function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0)
        return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0)
        return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}
// State
let baseTimeMap = {};
let activeDomain = null;
let activeStartTime = 0;
let isPaused = false;
let stoppedDomains = [];
let maxBaseTime = 1;
function getLiveTimeMap() {
    const live = { ...baseTimeMap };
    if (activeDomain && !isPaused && !stoppedDomains.includes(activeDomain)) {
        const extra = Date.now() - activeStartTime;
        live[activeDomain] = (live[activeDomain] || 0) + extra;
    }
    return live;
}
function tickTimes() {
    const live = getLiveTimeMap();
    const liveMax = Math.max(...Object.values(live), 1);
    let totalMs = 0;
    for (const [domain, ms] of Object.entries(live)) {
        totalMs += ms;
        const domainEl = document.getElementById(`domain-${domain.replace(/\./g, '_')}`);
        if (domainEl) {
            const timeEl = domainEl.querySelector('.domain-time');
            if (timeEl)
                timeEl.textContent = formatTime(ms);
            const bar = domainEl.querySelector('.progress-bar');
            if (bar)
                bar.style.width = `${Math.max(2, (ms / liveMax) * 100)}%`;
        }
    }
    const totalTimeEl = document.getElementById('total-time');
    if (totalTimeEl)
        totalTimeEl.textContent = formatTime(totalMs);
}
async function updatePopup() {
    const result = await chrome.storage.local.get(['timeMap', 'trackerState', 'isPaused', 'stoppedDomains', 'theme']);
    baseTimeMap = (result.timeMap || {});
    const trackerState = result.trackerState;
    activeDomain = trackerState?.activeDomain ?? null;
    activeStartTime = trackerState?.startTime ?? Date.now();
    isPaused = !!result.isPaused;
    stoppedDomains = (result.stoppedDomains || []);
    // Update Theme
    const isLightTheme = result.theme === 'light';
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (isLightTheme) {
        document.body.classList.add('light-theme');
        if (themeBtn)
            themeBtn.textContent = '☀️';
    }
    else {
        document.body.classList.remove('light-theme');
        if (themeBtn)
            themeBtn.textContent = '🌙';
    }
    // Update Status Badge & Toggles
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    const pauseToggleBtn = document.getElementById('btn-pause-toggle');
    const pauseIcon = document.getElementById('pause-icon');
    const pauseText = document.getElementById('pause-text');
    if (statusBadge && statusText && pauseToggleBtn && pauseIcon && pauseText) {
        if (isPaused) {
            statusBadge.className = 'status-badge status-paused';
            statusText.textContent = 'Paused';
            pauseToggleBtn.className = 'btn btn-resume';
            pauseIcon.textContent = '▶️';
            pauseText.textContent = 'Resume';
        }
        else {
            statusBadge.className = 'status-badge status-active';
            statusText.textContent = 'Active';
            pauseToggleBtn.className = 'btn btn-pause';
            pauseIcon.textContent = '⏸️';
            pauseText.textContent = 'Pause';
        }
    }
    // Render Excluded list
    const excludedSection = document.getElementById('excluded-section');
    const excludedList = document.getElementById('excluded-list');
    if (excludedSection && excludedList) {
        if (stoppedDomains.length > 0) {
            excludedSection.style.display = 'block';
            excludedList.innerHTML = '';
            stoppedDomains.forEach(domain => {
                const item = document.createElement('div');
                item.className = 'excluded-item';
                item.innerHTML = `
          <span class="excluded-name" title="${domain}">${domain}</span>
          <button class="btn-restore" data-domain="${domain}">
            <span>🔄</span> Restore
          </button>
        `;
                excludedList.appendChild(item);
            });
            // Bind restore buttons
            excludedList.querySelectorAll('.btn-restore').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const dom = e.currentTarget.getAttribute('data-domain');
                    if (dom) {
                        const result = await chrome.storage.local.get(['stoppedDomains']);
                        const currentStopped = (result.stoppedDomains || []);
                        const updated = currentStopped.filter((d) => d !== dom);
                        await chrome.storage.local.set({ stoppedDomains: updated });
                        updatePopup();
                    }
                });
            });
        }
        else {
            excludedSection.style.display = 'none';
        }
    }
    // Render Tracked Domains
    const liveTimeMap = getLiveTimeMap();
    const sortedDomains = Object.entries(liveTimeMap).sort((a, b) => b[1] - a[1]);
    const domainsList = document.getElementById('domains');
    if (!domainsList)
        return;
    if (sortedDomains.length === 0) {
        domainsList.innerHTML = '<div class="empty-state">No time tracked yet. Start browsing!</div>';
        const totalTimeEl = document.getElementById('total-time');
        if (totalTimeEl)
            totalTimeEl.textContent = '0s';
        return;
    }
    maxBaseTime = sortedDomains[0][1] || 1;
    domainsList.innerHTML = '';
    for (const [domain, ms] of sortedDomains) {
        const li = document.createElement('li');
        li.className = 'domain-item';
        li.id = `domain-${domain.replace(/\./g, '_')}`;
        const percentage = Math.max(2, (ms / maxBaseTime) * 100);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        li.innerHTML = `
      <div class="domain-header">
        <div class="domain-name">
          <img src="${faviconUrl}" alt="" onerror="this.style.display='none'">
          <span id="domain-title" title="${domain}">${domain}</span>
        </div>
        <div class="domain-right">
          <span class="domain-time">${formatTime(ms)}</span>
          <div class="domain-actions">
            <button class="action-btn action-stop" data-domain="${domain}" title="Stop tracking this website">🚫</button>
            <button class="action-btn action-delete" data-domain="${domain}" title="Delete tracked time">🗑️</button>
          </div>
        </div>
      </div>
      <div class="progress-track">
        <div class="progress-bar" style="width: ${percentage}%"></div>
      </div>
    `;
        domainsList.appendChild(li);
    }
    // Bind individual actions
    domainsList.querySelectorAll('.action-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const dom = e.currentTarget.getAttribute('data-domain');
            if (dom) {
                const confirmDelete = confirm(`Are you sure you want to delete tracked time for ${dom} today?`);
                if (!confirmDelete)
                    return;
                const result = await chrome.storage.local.get(['timeMap', 'trackerState']);
                const timeMap = (result.timeMap || {});
                const trackerState = result.trackerState;
                delete timeMap[dom];
                // If the deleted domain was active, reset activeStartTime
                if (trackerState && trackerState.activeDomain === dom) {
                    trackerState.startTime = Date.now();
                }
                await chrome.storage.local.set({ timeMap, trackerState });
                updatePopup();
            }
        });
    });
    domainsList.querySelectorAll('.action-stop').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const dom = e.currentTarget.getAttribute('data-domain');
            if (dom) {
                const confirmStop = confirm(`Stop tracking ${dom}? Past data will be removed and it will be excluded in the future.`);
                if (!confirmStop)
                    return;
                const result = await chrome.storage.local.get(['timeMap', 'trackerState', 'stoppedDomains']);
                const timeMap = (result.timeMap || {});
                const trackerState = result.trackerState;
                const stoppedDomains = (result.stoppedDomains || []);
                // Remove from list
                delete timeMap[dom];
                // Add to stopped domains
                if (!stoppedDomains.includes(dom)) {
                    stoppedDomains.push(dom);
                }
                // If the stopped domain was active, set activeDomain to null
                if (trackerState && trackerState.activeDomain === dom) {
                    trackerState.activeDomain = null;
                    trackerState.startTime = Date.now();
                }
                await chrome.storage.local.set({ timeMap, trackerState, stoppedDomains });
                updatePopup();
            }
        });
    });
    tickTimes();
}
// Bind Global controls
document.addEventListener('DOMContentLoaded', () => {
    updatePopup();
    setInterval(tickTimes, 1000);
    // Theme toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', async () => {
            const isLight = document.body.classList.toggle('light-theme');
            themeBtn.textContent = isLight ? '☀️' : '🌙';
            await chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
        });
    }
    // Pause toggle
    const pauseToggleBtn = document.getElementById('btn-pause-toggle');
    if (pauseToggleBtn) {
        pauseToggleBtn.addEventListener('click', async () => {
            const result = await chrome.storage.local.get(['isPaused']);
            const nextState = !result.isPaused;
            await chrome.storage.local.set({ isPaused: nextState });
            updatePopup();
        });
    }
    // Clear all
    const clearAllBtn = document.getElementById('btn-clear-all');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', async () => {
            const confirmClear = confirm('Are you sure you want to clear all tracked time data today? This cannot be undone.');
            if (!confirmClear)
                return;
            const result = await chrome.storage.local.get(['trackerState']);
            const trackerState = result.trackerState;
            if (trackerState) {
                trackerState.startTime = Date.now();
            }
            await chrome.storage.local.set({
                timeMap: {},
                trackerState: trackerState || { activeDomain: null, startTime: Date.now() }
            });
            updatePopup();
        });
    }
});
// Reactively refresh when storage changes (e.g. background records new time or day resets)
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.timeMap || changes.trackerState)) {
        chrome.storage.local.get(['timeMap', 'trackerState']).then(result => {
            baseTimeMap = (result.timeMap || {});
            const trackerState = result.trackerState;
            activeDomain = trackerState?.activeDomain ?? null;
            activeStartTime = trackerState?.startTime ?? Date.now();
        });
    }
});
export {};
