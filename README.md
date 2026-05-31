# ⏱️ Time Tracker — Chrome Extension

Tracks time spent on every website and uses AI to calculate your productive vs wasted hours, give you a productivity score, and personalized advice.

## 🚀 Setup (3 steps)

### 1. Get a free API key
Go to [openrouter.ai](https://openrouter.ai), sign up, and copy your API key.

### 2. Add your key
Open `src/config.ts` and paste your key:

```ts
export const OPENROUTER_API_KEY = "your-api-key-here";
export const OPENROUTER_MODEL   = "google/gemma-4-31b-it:free";
```

You can pick any free model from [openrouter.ai/models](https://openrouter.ai/models?q=free).

### 3. Build & load
```bash
npm install
npm run build
```

Then open Chrome → `chrome://extensions/` → **Load unpacked** → select this folder.

---

## 🗂️ Project Structure

```
├── src/
│   ├── config.ts       ← Add your API key here
│   ├── popup.ts        ← Popup UI logic
│   └── background.ts   ← Time tracking service worker
├── dist/               ← Compiled JS (auto-generated)
├── public/
│   └── tab-summary-icon.png
├── index.html
└── manifest.json
```

## 🛠️ Development

After editing any `.ts` file, re-run:
```bash
npm run build
```
Then click **Reload** on the extension in `chrome://extensions/`.
