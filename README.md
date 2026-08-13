# FasDM Mesh – Decentralized Internet-Free Messaging & Media Transfer

> **FasDM Mesh** is a decentralized, internet-free Peer-to-Peer (P2P) encrypted messaging and media sharing platform. Operating over local physical networks (LAN, Wi-Fi Direct, and Bluetooth LE), FasDM enables nodes to discover nearby devices, establish encrypted P2P mesh links, broadcast group communications, and exchange files without requiring an active internet connection or centralized cloud servers.

---

## Project Overview

FasDM (Fast & Secure Decentralized Messaging) addresses communication needs in off-grid, emergency, localized, or privacy-sensitive scenarios. Built on modern web standards and P2P browser technologies, FasDM turns any web browser instance into an autonomous mesh node capable of real-time offline discovery, direct messaging, file transfer, and group hub administration.

---

## Key Features & Functional Modules

### 1. Decentralized Peer Discovery & Network Scanner
- **Multi-Transport Support**: Operates over local LAN, Wi-Fi Direct, and Bluetooth channels.
- **Real-Time Signal Metrics**: Monitors peer signal strength (RSSI in dBm) and network latency (ms).
- **Unread Notification Highlights**: Peers with unread messages are highlighted in the nearby devices scanner with glowing borders, notification badges ("Unread Message!"), and instant clearance upon opening the chat room.

### 2. Direct P2P Encrypted Messaging
- **1-to-1 Instant Messaging**: Secure direct messaging with status indicators (Sent, Delivered, Read).
- **Real-Time Typing Indicators**: Visual typing feedback when peers construct messages.
- **Quick Reaction Bar**: One-tap quick reaction bar.
- **Chat History Management**: Clear or view chat logs stored locally.

### 3. Multi-Node Group Mesh Hub
- **Group Creation & Administration**: Create P2P mesh groups, invite online nodes, and assign group administrators.
- **Group Broadcast Messaging**: Broadcast text messages and media attachments to all group members.
- **Admin Controls**: Delete group channels or manage membership.

### 4. P2P File & Media Sharing Engine
- **Multi-Format Attachment Support**: Share images, videos, audio clips, PDFs, and generic files (up to 25MB).
- **Automatic Transport Escalation**: Large files (> 5MB) automatically escalate to high-throughput **Wi-Fi Direct** transport for faster transfer.
- **Inline Compact Previews**: Sleek 120px in-chat thumbnail preview cards for non-intrusive feed viewing.
- **3X Expanded Media Viewer**: Full-screen modal media viewer with high-definition preview capabilities and immediate download controls.

### 5. Identity & Storage Engine
- **Cryptographic QR Pairings**: Share public node identity using auto-generated QR codes.
- **IndexedDB Offline Persistence**: Zero-cloud data persistence storing profile keys, messages, and shared files locally.
- **Session Isolation**: Tab-level session isolation (`sessionStorage`), allowing multiple node identities to run side-by-side in separate browser windows or tabs.

---

## Technology Stack

- **Frontend Core**: React 19, TypeScript
- **Build Tooling**: Vite 6
- **Styling**: Vanilla CSS3, Cyberpunk Dark Mode & Glassmorphism Design System
- **Icons**: Lucide React
- **P2P Broadcast Transport**: Web BroadcastChannel API & P2P Service Architecture
- **Offline Persistence**: Browser IndexedDB (`dbEngine`) & `sessionStorage`
- **Cryptography & Utilities**: WebCrypto API, `qrcode`, `canvas-confetti`

---

## Installation Steps

### Prerequisites
Make sure you have Node.js (v18.0.0 or higher) and `npm` installed on your machine.

- Node.js: `node -v`
- NPM: `npm -v`

### 1. Clone the Repository
```bash
git clone https://github.com/Samar-365/FasDM.git
cd FasDM
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Development Server
```bash
npm run dev
```

The application will start locally at:
```text
  ➜  Local:   http://localhost:3000/
  ➜  Network: http://<your-local-ip>:3000/
```

### 4. Build for Production (Optional)
To verify TypeScript compilation and create an optimized production build:
```bash
npm run build
```

To preview the production build locally:
```bash
npm run preview
```

---

## Operation & Testing Guide

### Scenario A: Multi-Node Testing in Separate Tabs/Windows
1. **Open Tab 1**: Navigate to `http://localhost:3000/`.
   - Click **Get Started** on the Splash Screen.
   - Enter node handle (e.g. `Samar`) and pick an avatar.
   - Click **Create P2P Identity & Launch Node**.
2. **Open Tab 2**: Open a second browser tab or private window at `http://localhost:3000/`.
   - Tab 2 starts fresh on the Splash Screen.
   - Click **Get Started** and register a second node handle (e.g. `Priya`).
3. **Discover Peers**:
   - Both nodes will automatically discover each other over the local P2P mesh channel.
   - Navigate to the **Nearby Devices** tab in either node to view the discovered peer.
4. **Send Messages & Files**:
   - Click **Start P2P Chat** on a discovered peer card.
   - Send text messages or click the paperclip icon to send images/files.
   - If Tab 2 has not opened the chat yet, Tab 2's **Nearby Devices** tab will display a glowing red notification badge ("1 New").

### Scenario B: Single-Tab Simulated Peer Generator
If you want to test P2P features in a single tab without opening multiple windows:
1. Go to the **Nearby Devices** tab.
2. In the **Single-Tab Peer Simulation Generator** bar, click **+ Sim LAN Peer** or **+ Sim Wi-Fi Direct**.
3. A simulated node (e.g. `Rahul Sharma (LAN)`) will spawn immediately.
4. Click **Start P2P Chat** to interact with auto-replying simulated peer nodes.

---

## Project Structure

```text
fasdm/
├── public/                  # Static web assets
├── src/
│   ├── components/          # UI Components
│   │   ├── ChatRoom.tsx         # Direct 1-to-1 P2P Chat Room
│   │   ├── Dashboard.tsx        # Main Application Navigation & Stats
│   │   ├── FileViewerModal.tsx  # Full View Media & File Viewer
│   │   ├── GroupChatRoom.tsx    # Multi-node Group Hub & Admin Controls
│   │   ├── Navbar.tsx           # Header Navigation Bar
│   │   ├── PeerScanner.tsx      # Discovered Nearby Devices Grid
│   │   ├── ProfileSetup.tsx     # Identity Registration Page
│   │   └── SplashScreen.tsx     # Initial Landing & Welcome Screen
│   ├── services/            # Core Engine Services
│   │   ├── crypto.ts            # WebCrypto Key Generation & QR Payload Formatting
│   │   ├── db.ts                # IndexedDB Storage Engine
│   │   └── network.ts           # P2P Mesh Transport Engine (BroadcastChannel/Channels)
│   ├── types/               # TypeScript Type Definitions
│   ├── App.tsx              # Main Router Component
│   ├── main.tsx             # Application Entry Point
│   └── index.css            # Cyberpunk Design System & Styling
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## License & Credits

Developed by **Samar** for the **FasDM Mesh Project**.  
Distributed under the MIT License.