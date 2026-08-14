# FasDM Mesh – Decentralized Internet-Free Messaging & Media Transfer

> **FasDM Mesh** is a decentralized, internet-free Peer-to-Peer (P2P) encrypted messaging, voice notes, and media sharing platform. Operating over local physical networks (LAN, Wi-Fi Direct, and Bluetooth LE), FasDM enables nodes to discover nearby devices, establish encrypted P2P mesh links, broadcast group communications, exchange files, and transmit voice messages without requiring an active internet connection or centralized cloud servers.

---

## Project Overview

FasDM (Fast & Secure Decentralized Messaging) addresses communication needs in off-grid, emergency, localized, or privacy-sensitive scenarios. Built on modern web standards and P2P browser technologies, FasDM turns any web browser instance into an autonomous mesh node capable of real-time offline discovery, direct messaging, voice messaging, file transfer, and group hub administration.

---

## 8 Completed Core Modules & Features

### 1. User Profile & Cryptographic Identity (Module 1)
- **Zero-Cloud Identity**: Web Crypto API P-256 ECDH keypair generation & SHA-256 fingerprint creation.
- **Tab Session Isolation**: Independent session management (`sessionStorage`), allowing multiple node identities to run side-by-side in separate browser windows/tabs.

### 2. Decentralized Peer Discovery & Network Scanner (Module 2)
- **Multi-Transport Support**: Operates across local LAN, Wi-Fi Direct, and Bluetooth channels.
- **Real-Time Signal Metrics**: Monitors peer signal strength (RSSI in dBm) and network latency (ms).
- **Unread Notification Highlights**: Peers with unread messages are highlighted with glowing borders, notification badges ("Unread Message!"), and auto-clearing indicators.
- **Self-Peer Exclusion**: Smart filtering prevents nodes from discovering themselves as nearby peers.

### 3. Optical QR Code Pairing (Module 3)
- **Out-of-Band Pairing**: Dynamic optical QR code generation embedding Node ID, Username, Public Key, and Key Fingerprint.
- **Identity Verification**: QR modal for identity verification.

### 4. Direct 1-to-1 Encrypted Messaging (Module 4)
- **End-to-End Encryption**: Direct peer-to-peer text exchange with payload encryption.
- **Strict Deduplication**: Message pipelines deduplicate incoming packets by `messageId`, `fileId`, and `voiceId` across browser tabs.

### 5. Message Status & Real-Time Indicators (Module 5)
- **Delivery Receipts**: Sent (single check), Delivered (double check), and Read (cyan double check).
- **Typing Indicators**: Dynamic real-time typing indicators ("User is typing...").
- **Quick Reaction Bar**: One-tap emoji reactions.

### 6. Multi-Node Group Mesh Hub (Module 6)
- **Group Creation & Administration**: Create P2P mesh groups, invite discovered nodes, and assign group administrators.
- **Group Broadcast Messaging**: Multi-node broadcast messaging over mesh transport.
- **Admin & Member Controls**: Leave group, remove members, or delete group channels with automatic grid cleanup.

### 7. P2P File Sharing Engine & 3X Media Viewer (Module 7)
- **Multi-Format Attachment Support**: Share images, videos, audio clips, PDFs, and generic files (up to 25MB).
- **Automatic Transport Escalation**: Large files (> 5MB) automatically escalate to high-throughput **Wi-Fi Direct** transport for faster transfer.
- **Inline Compact Thumbnail Cards**: Sleek 120px in-chat thumbnail preview cards for neat timeline feeds.
- **3X Expanded Media Viewer**: Full-screen modal media viewer with high-definition preview capabilities and immediate download controls.

### 8. Voice Notes & Audio Messaging (Module 8)
- **MediaRecorder & Opus Audio Engine**: In-browser microphone capture with auto-detected codec (`audio/webm;codecs=opus`, `audio/ogg;codecs=opus`).
- **Live Frequency Waveform Visualizer**: Web Audio API (`AudioContext`, `AnalyserNode`) powers a real-time 24-bar pulsating audio waveform during recording.
- **Instant One-Click Send & Review Modes**:
  - **Instant Send**: Single-click to stop and transmit voice notes immediately.
  - **Stop & Review**: Preview recorded audio, check duration, re-record, or send.
- **Minimal 210px Inline Player**: Ultra-compact in-bubble audio player featuring:
  - Play/Pause toggle with audio state management.
  - 20 interactive click-to-seek acoustic waveform visualizer bars.
  - Dynamic `MM:SS` elapsed/total duration timestamps.
  - Offline one-click audio download button.
  - Distinct sender (blue glass) and receiver (slate/cyan) theme styling.

---

## Technology Stack

- **Frontend Core**: React 19, TypeScript
- **Build Tooling**: Vite 6
- **Audio & Media**: Web Audio API (`AudioContext`, `AnalyserNode`), MediaRecorder API, HTML5 Audio
- **Styling**: Vanilla CSS3, Cyberpunk Dark Mode & Glassmorphism Design System
- **Icons**: Lucide React
- **P2P Broadcast Transport**: Web BroadcastChannel API & P2P Service Architecture
- **Offline Persistence**: Browser IndexedDB (`dbEngine`) & `sessionStorage`
- **Cryptography & Utilities**: WebCrypto API, `qrcode`, `canvas-confetti`

---

## Installation & Setup

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
4. **Send Text, Files & Voice Notes**:
   - Click **Start P2P Chat** on a discovered peer card.
   - **Text**: Type a message and hit Send.
   - **Files**: Click the paperclip icon to send images, videos, or documents.
   - **Voice Notes**: Click the **Mic** button -> speak -> click **Send** for instant transmission, or **Stop** to preview and listen before sending.

### Scenario B: Single-Tab Simulated Peer Generator
If you want to test P2P features in a single tab without opening multiple windows:
1. Go to the **Nearby Devices** tab.
2. In the **Single-Tab Peer Simulation Generator** bar, click **+ Sim LAN Peer** or **+ Sim Wi-Fi Direct**.
3. A simulated node (e.g. `Rahul Sharma (LAN)`) will spawn immediately.
4. Click **Start P2P Chat** to interact with auto-replying simulated peer nodes (supporting text replies, file transfer ACKs, and voice note acknowledgments).

---

## Project Structure

```text
fasdm/
├── public/                  # Static web assets
├── src/
│   ├── components/          # UI Components
│   │   ├── AudioRecorder.tsx    # MediaRecorder & Live Waveform Bar
│   │   ├── ChatRoom.tsx         # Direct 1-to-1 P2P Chat Room
│   │   ├── Dashboard.tsx        # Main Application Navigation & Stats
│   │   ├── FileViewerModal.tsx  # Full View Media & File Viewer
│   │   ├── GroupChatRoom.tsx    # Multi-node Group Hub & Admin Controls
│   │   ├── Navbar.tsx           # Header Navigation Bar
│   │   ├── PeerScanner.tsx      # Discovered Nearby Devices Grid
│   │   ├── ProfileSetup.tsx     # Identity Registration Page
│   │   ├── SplashScreen.tsx     # Initial Landing & Welcome Screen
│   │   └── VoiceNotePlayer.tsx  # Compact Inline Audio Player
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
├── module_breakdown.txt     # 12-Module Implementation Specifications
└── README.md
```

---

## License & Credits

Developed by **Samar** for the **FasDM Mesh Project**.  
Distributed under the MIT License.