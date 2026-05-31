import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from './config.js';
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
function formatTimeShort(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}
async function analyzeWithAI(timeMap) {
    const data = Object.entries(timeMap)
        .map(([domain, ms]) => `${domain}: ${Math.round(ms / 1000)} seconds`)
        .join('\n');
    if (!data)
        return null;
    const prompt = `You are a productivity adviser. I will provide you with a user's web browsing data (domain and time spent).
Categorize every single domain as "productive", "wasted", or "neutral", and provide a short piece of actionable advice based on their browsing habits.
Data:
${data}

Respond ONLY with a valid JSON object in the exact following format. Do not include markdown tags like \`\`\`json.
{
  "advice": "string",
  "categories": {
    "domain.com": "productive" | "wasted" | "neutral"
  }
}`;
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [{ role: "user", content: prompt }]
            })
        });
        const json = await response.json();
        console.log("AI Response:", json);
        if (json.error) {
            console.error("OpenRouter Error:", json.error);
            return {
                advice: response.status === 429
                    ? "Rate limit exceeded on free AI tier. Please wait a moment before trying again."
                    : `API Error: ${json.error.message || 'Unknown error'}`,
                categories: {}
            };
        }
        if (!json.choices || !json.choices[0])
            throw new Error("Invalid API response format");
        const text = json.choices[0].message.content;
        const match = text.match(/\{[\s\S]*\}/);
        if (match)
            return JSON.parse(match[0]);
        return JSON.parse(text);
    }
    catch (e) {
        console.error("AI Analysis failed:", e);
        return null;
    }
}
// ── State shared between initial load and live ticker ──
let baseTimeMap = {};
let activeDomain = null;
let activeStartTime = 0;
let aiCategories = {};
let maxBaseTime = 1;
/** Returns the live time map with active domain's elapsed time added */
function getLiveTimeMap() {
    const live = { ...baseTimeMap };
    if (activeDomain) {
        const extra = Date.now() - activeStartTime;
        live[activeDomain] = (live[activeDomain] || 0) + extra;
    }
    return live;
}
/** Updates only time displays and progress bars — no DOM rebuild, no AI call */
function tickTimes() {
    const live = getLiveTimeMap();
    const liveMax = Math.max(...Object.values(live), 1);
    let productiveMs = 0;
    let wastedMs = 0;
    for (const [domain, ms] of Object.entries(live)) {
        // Update time label
        const domainEl = document.getElementById(`domain-${domain}`);
        if (domainEl) {
            const timeEl = domainEl.querySelector('.domain-time');
            if (timeEl)
                timeEl.textContent = formatTime(ms);
            const bar = domainEl.querySelector('.progress-bar');
            if (bar)
                bar.style.width = `${Math.max(2, (ms / liveMax) * 100)}%`;
        }
        const cat = aiCategories[domain] ?? "neutral";
        if (cat === 'productive')
            productiveMs += ms;
        if (cat === 'wasted')
            wastedMs += ms;
    }
    // Update stat cards
    const statProd = document.getElementById('stat-productive');
    const statWasted = document.getElementById('stat-wasted');
    if (statProd)
        statProd.textContent = formatTimeShort(productiveMs);
    if (statWasted)
        statWasted.textContent = formatTimeShort(wastedMs);
    // Update score
    const totalScoredMs = productiveMs + wastedMs;
    const score = totalScoredMs > 0 ? Math.round((productiveMs / totalScoredMs) * 100) : 0;
    const scoreBar = document.getElementById('score-bar');
    const scoreText = document.getElementById('score-text');
    if (scoreBar)
        scoreBar.style.width = `${score}%`;
    if (scoreText)
        scoreText.textContent = `${score}%`;
}
async function updatePopup() {
    const result = await chrome.storage.local.get(['timeMap', 'trackerState']);
    const trackerState = result.trackerState;
    baseTimeMap = (result.timeMap || {});
    activeDomain = trackerState?.activeDomain ?? null;
    activeStartTime = trackerState?.startTime ?? Date.now();
    const liveTimeMap = getLiveTimeMap();
    const sortedDomains = Object.entries(liveTimeMap).sort((a, b) => b[1] - a[1]);
    const domainsList = document.getElementById('domains');
    if (!domainsList)
        return;
    if (sortedDomains.length === 0) {
        domainsList.innerHTML = '<div class="empty-state">No time tracked yet. Start browsing!</div>';
        return;
    }
    const insightsText = document.getElementById('insights-text');
    if (insightsText)
        insightsText.textContent = "AI is analyzing your browsing data...";
    // Build domain list once
    maxBaseTime = sortedDomains[0][1] || 1;
    domainsList.innerHTML = '';
    for (const [domain, ms] of sortedDomains) {
        const li = document.createElement('li');
        li.className = 'domain-item';
        li.id = `domain-${domain}`;
        const percentage = Math.max(2, (ms / maxBaseTime) * 100);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        li.innerHTML = `
      <div class="domain-header">
        <div class="domain-name">
          <img src="${faviconUrl}" alt="" onerror="this.style.display='none'">
          ${domain}
          <span class="domain-category" id="cat-${domain}">...</span>
        </div>
        <div class="domain-time">${formatTime(ms)}</div>
      </div>
      <div class="progress-track">
        <div class="progress-bar" style="width: ${percentage}%"></div>
      </div>
    `;
        domainsList.appendChild(li);
    }
    // Start live ticker (every second)
    setInterval(tickTimes, 1000);
    // Fetch AI analysis (one time)
    const aiResult = await analyzeWithAI(liveTimeMap);
    if (aiResult) {
        console.log("AI Result:", aiResult);
        aiCategories = aiResult.categories ?? {};
        // Apply category labels
        for (const [domain, cat] of Object.entries(aiCategories)) {
            const catEl = document.getElementById(`cat-${domain}`);
            if (catEl) {
                catEl.textContent = cat;
                catEl.className = `domain-category cat-${cat}`;
            }
        }
        if (insightsText && aiResult.advice)
            insightsText.textContent = aiResult.advice;
    }
    else {
        if (insightsText)
            insightsText.textContent = "Could not fetch AI insights. Please try again.";
    }
}
document.addEventListener('DOMContentLoaded', () => {
    updatePopup();
});
