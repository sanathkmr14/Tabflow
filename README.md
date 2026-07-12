# Tabflow: AI-Powered Browser Workspace

Tabflow is a next-generation browser extension designed to supercharge your productivity. It uses advanced AI to act as your personal assistant, organizing your tabs into dedicated workspaces, securing your private content with AES-256 encryption, and scheduling your workflow automatically.

## ✨ Key Features

- **🤖 AI Assistant Integration:** Talk to your built-in AI assistant directly from the dashboard. Ask it to organize tabs, close specific sites (e.g., "close all YouTube tabs"), or summarize content. The AI understands natural language and controls the browser for you!
- **📁 Smart Workspaces:** Group your open tabs into distinct, named folders (like "Work", "Entertainment", or "Research"). 
- **🗺️ Interactive Workspace Map:** Visualize all your folders in a dynamic, draggable node-based canvas. Pin your most important folders to the top.
- **🔒 AES-256 Folder Encryption:** Need privacy? Lock specific folders with a custom password. Tabs inside locked folders are hidden and inaccessible until you unlock them. Includes a recovery phrase fallback system.
- **⏱️ Automated Tab & Folder Scheduling:** Schedule entire workspaces or individual tabs to open or close at specific dates and times automatically.
- **⚡ Quick-Access Popup:** Click the Tabflow extension icon in your browser toolbar to instantly save your current tab into any of your folders without opening the full dashboard.

## 🚀 Installation Guide

Since Tabflow is currently in developer preview, you can easily install it locally in any Chromium-based browser (Chrome, Edge, Brave, Opera, Vivaldi).

1. Clone this repository or download the ZIP file.
2. Unzip the downloaded file to a permanent folder on your computer.
3. Open your browser and go to your extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
4. Turn on **"Developer mode"** (usually a toggle in the top right corner).
5. Click **"Load unpacked"** (or "Load unpacked extension").
6. Select the folder where you unzipped Tabflow.
7. **Important:** Click on "Details" for the Tabflow extension and turn on **"Allow in Incognito"** so you can manage your private browsing tabs too.
8. **You're done!** Pin the Tabflow icon to your toolbar for easy access.
## 🛠️ How to Use It

### The Dashboard
To open the main dashboard, simply click the Tabflow extension icon in your toolbar and click **"Open Dashboard"**. From here, you can drag and drop folders on the canvas, talk to the AI assistant on the right panel, and manage all your tabs.

### Chatting with the AI
In the dashboard, you will see a chat window on the right. You can ask it to perform actions like:
- *"Close all my tabs except the dashboard."*
- *"Move my Netflix tab from Inbox to Entertainment."*
- *"Schedule the Work folder to open tomorrow at 9 AM."*
Before the AI executes any command, a **Confirm Actions** popup will appear so you can review and approve exactly what it intends to do.

### Locking a Workspace
To secure a workspace:
1. Hover over the folder in the dashboard sidebar.
2. Click the 🔒 Lock icon.
3. Set a password and a recovery word.
4. Once locked, the folder's contents will be completely hidden. To unlock it, click the lock icon again and enter your password.

## 🏗️ Technologies Used
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion (for smooth animations)
- Chrome Extensions API (Manifest V3)
- WebCrypto API (for secure AES-256 encryption)
