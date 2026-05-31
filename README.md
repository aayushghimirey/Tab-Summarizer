# ⏱️ Time Tracker — Chrome Extension

A beautiful, dark-themed Chrome extension that tracks the time spent on every website you visit in real time. It features a modern, interactive dashboard with global tracking controls and domain management tools.

## ✨ Features

- **Real-Time Tracking**: Accurately tracks active browsing time per domain down to the second.
- **Global Pause & Resume**: Stop tracking all tabs globally and start again with a single toggle.
- **Individual Deletion**: Remove today's tracked data for a specific website.
- **Bulk Data Wiping**: Clear all tracked times for the day using the "Clear All" button.
- **Excluded Domains (Blacklist)**: Stop tracking specific domains. Blocked domains are managed in the "Excluded Websites" panel where they can be restored back to tracking at any time.
- **Daily Automatic Reset**: Automatically resets tracked stats at midnight for a fresh start.
- **No Dependencies/AI**: Fully self-contained extension with no environment configurations or API keys required.

## 🚀 Setup

### 1. Install & Build
First, install the development dependencies and compile the TypeScript sources:
```bash
npm install
npm run build
```

### 2. Load the Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the project folder.

---

## 🗂️ Project Structure

```
├── src/
│   ├── popup.ts        ← Popup UI behavior & interaction logic
│   └── background.ts   ← Main time tracker & state service worker
├── dist/               ← Compiled JavaScript assets (built automatically)
├── public/
│   └── tab-summary-icon.png
├── index.html          ← Popup dashboard layout & styles
└── manifest.json       ← Chrome Extension MV3 manifest config
```

## 🛠️ Development

When editing any `.ts` files inside the `src/` directory, re-run:
```bash
npm run build
```
Then click the **Reload (🔄)** button on the extension card in `chrome://extensions/`.
