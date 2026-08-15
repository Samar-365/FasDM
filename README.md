# FasDM Mesh – Decentralized Internet-Free Messaging & Media Transfer

> **FasDM Mesh** is a decentralized, internet-free Peer-to-Peer (P2P) encrypted messaging, voice notes, media sharing, and real-time collaboration platform. Operating over local physical networks (LAN, Wi-Fi Direct, and Bluetooth LE), FasDM enables nodes to discover nearby devices, establish encrypted P2P mesh links, broadcast group communications, exchange files, transmit voice messages, and collaborate on shared whiteboards, checklists, and sticky notes without requiring an active internet connection or centralized cloud servers.

---

## Project Highlights

- **Zero-Cloud Cryptographic Identity**: In-browser P-256 ECDH keypair generation with SHA-256 fingerprint verification and optical QR pairing.
- **Multi-Transport P2P Discovery**: Autonomous local device discovery and beaconing across LAN, Wi-Fi Direct, and Bluetooth channels with signal metrics (RSSI, latency).
- **Encrypted 1-to-1 & Group Messaging**: End-to-end payload encryption, delivery receipts (Sent, Delivered, Read), live typing indicators, and emoji reactions.
- **High-Speed File Sharing & 3X Media Viewer**: Support for images, videos, audio, PDFs, and generic files with automatic transport escalation to Wi-Fi Direct (> 5MB) and a full-screen 3X modal viewer.
- **Voice Notes & Waveform Engine**: MediaRecorder & Opus audio engine with real-time 24-bar Web Audio API visualizer, instant transmission, preview mode, and ultra-compact 210px seekable inline player.
- **Real-Time Collaboration Suite**: Shared Whiteboard canvas with multi-device normalized scaling, interactive shared task checklists, and freeform draggable sticky notes.
- **Offline-First Persistence**: IndexedDB (Schema v4) database engine providing reliable offline history, cross-reboot storage, and session isolation.

---

## 12-Module System Status & Architecture

| Module | SRS Mapping | Description | Status |
| :--- | :--- | :--- | :---: |
| **Module 1: User Profile & Identity** | FR-1, FR-15 | User handles, avatars, Web Crypto P-256 ECDH keys & SHA-256 fingerprints | Completed |
| **Module 2: Device Discovery & Scanner** | FR-2 | Multi-transport peer scanning, RSSI metrics, unread notification badges | Completed |
| **Module 3: Optical QR Code Pairing** | FR-3 | Out-of-band QR identity exchange & fingerprint verification modal | Completed |
| **Module 4: One-to-One Encrypted Chat** | FR-4, FR-15 | Direct P2P encrypted text messaging, packet deduplication & delivery ticks | Completed |
| **Module 5: Message Status & Typing** | FR-8, FR-9 | Sent/Delivered/Read receipts, live typing status, quick emoji reaction bar | Completed |
| **Module 6: Multi-Node Group Mesh Hub** | FR-5 | P2P group mesh rooms, member invitations, admin rights & group broadcast | Completed |
| **Module 7: P2P File Sharing & 3X Viewer** | FR-6 | Multi-format file transfer, auto Wi-Fi Direct escalation & 3X expanded viewer | Completed |
| **Module 8: Voice Notes & Audio Engine** | FR-7 | Opus audio recording, 24-bar live visualizer, 210px inline seekable player | Completed |
| **Module 9: Emergency Broadcast System** | FR-10 | Priority emergency broadcast alerts & instant alert push | Pending |
| **Module 10: Shared Collaboration Suite** | FR-11, 12, 13 | Real-time Whiteboard, Task Checklist & Draggable Sticky Notes | Completed |
| **Module 11: Local Storage Engine** | FR-14 | IndexedDB Schema v4 persistence, storage quota monitor & state hydration | Completed |
| **Module 12: Mesh Routing Engine** | FR-16, FR-17 | Multi-hop routing overlay & dynamic transport auto-selection | In Progress |

---

## Technology Stack

- **Frontend Core**: React 19, TypeScript
- **Build Tooling & Dev Server**: Vite 6 (`host: true` enabled for LAN broadcasting)
- **Audio & Media**: Web Audio API (`AudioContext`, `AnalyserNode`), MediaRecorder API (Opus/WebM/Ogg), HTML5 Audio
- **Canvas & Graphics**: HTML5 2D Canvas API (quadratic Bezier smoothing, normalized scaling)
- **Styling**: Vanilla CSS3, Cyberpunk Dark Mode & Glassmorphism Design Tokens
- **Icons**: Lucide React
- **P2P Transport Simulation**: Web BroadcastChannel API & Service Worker Mesh Engine
- **Offline Persistence**: Browser IndexedDB (`dbEngine` v4) & `sessionStorage`
- **Cryptography & QR**: WebCrypto API, `qrcode`, `canvas-confetti`

---

## Setup & Installation on Another Device

You can set up and run FasDM on another computer (Windows, macOS, Linux) or access it seamlessly from mobile devices over your local network.

### Prerequisites

- **Node.js**: Version 18.0.0 or higher ([Download Node.js LTS](https://nodejs.org/))
- **Package Manager**: `npm` (comes bundled with Node.js) or `yarn` / `pnpm`
- **Git**: (Optional, if cloning via repository) ([Download Git](https://git-scm.com/))
- **Modern Browser**: Chrome, Edge, Firefox, Brave, or Safari (must support Web Crypto, IndexedDB, and Web Audio APIs)

---

### Method 1: Clean Installation via Git (Online / Connected Device)

Follow these steps to set up FasDM on a new device with internet access:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Samar-365/FasDM.git
   cd FasDM
   ```

2. **Install Project Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```

4. **Open in Your Browser**:
   Open your browser and navigate to:
   ```text
   http://localhost:3000/
   ```

---

### Method 2: Offline / Air-Gapped Setup via USB Drive (No Internet Required)

For emergency or offline environments where the target device cannot access the internet:

1. **Prepare the Package on the Source Device**:
   - Make sure `npm install` and `npm run build` have been executed on the source machine.
   - Copy the entire project folder (including `node_modules` or `dist/`) to a USB flash drive or portable storage device.

2. **Transfer to the Target Device**:
   - Plug the USB drive into the target device and copy the `fasdm` folder to your local drive (e.g. `C:\Projects\fasdm` or `~/projects/fasdm`).

3. **Launch the Application**:
   - Open a terminal or command prompt inside the transferred folder:
     ```bash
     npm run dev
     ```
   - *Alternatively*, if serving the static production build:
     ```bash
     npx vite preview --host
     ```
   - Open `http://localhost:3000/` in any modern web browser.

---

### Method 3: Access from Mobile Phones, Tablets & Laptops on the Same Network

Because the Vite dev server is pre-configured with `host: true`, any device connected to the same Wi-Fi router, mobile hotspot, or local network switch can access FasDM without installing Node.js:

1. **Find the Host Computer's Local IP Address**:
   - **Windows**: Open Command Prompt and run `ipconfig` (look for `IPv4 Address`, e.g., `192.168.1.15`).
   - **macOS / Linux**: Open Terminal and run `ifconfig` or `ip a` (look for `inet 192.168.x.x`).

2. **Start the Server on the Host Machine**:
   ```bash
   npm run dev
   ```
   The terminal will display:
   ```text
     ➜  Local:   http://localhost:3000/
     ➜  Network: http://192.168.1.15:3000/
   ```

3. **Connect from Other Devices**:
   - Connect your phone, tablet, or secondary laptop to the same Wi-Fi / Hotspot network.
   - Open the mobile browser (Chrome / Safari / Firefox) and type the Network URL:
     ```text
     http://192.168.1.15:3000/
     ```
   - Create your node profile and begin instant P2P communication!

> [!TIP]
> **Firewall Troubleshooting**: If the page does not load from other devices on the LAN, ensure that port `3000` is allowed in Windows Defender Firewall or your OS security settings.

---

## Operation & Testing Guide

### Scenario A: Multi-Node Testing on a Single Machine (Tabs / Windows)
1. **Open Node 1**: Navigate to `http://localhost:3000/`.
   - Click **Get Started** on the Splash Screen.
   - Enter handle (e.g., `Node-Alpha`) and choose an avatar.
   - Click **Create P2P Identity & Launch Node**.
2. **Open Node 2**: Open an Incognito Window or separate browser window at `http://localhost:3000/`.
   - Register a second handle (e.g., `Node-Beta`).
3. **P2P Discovery**:
   - Go to **Nearby Devices**; both nodes will automatically detect each other over local channels.
4. **Chat & Media Transfer**:
   - Click **Start P2P Chat**.
   - Send encrypted messages, voice notes with live waveforms, or share files up to 25MB.
5. **Collaboration Hub**:
   - Click **Collab Hub** in the header or dashboard to collaborate in real time on the **Shared Whiteboard**, **Interactive Checklist**, and **Sticky Notes Board**.

### Scenario B: Single-Tab Simulated Peer Generator
If you want to test all features in a single window without opening multiple tabs:
1. Open the **Nearby Devices** tab.
2. In the **Single-Tab Peer Simulation Generator**, click **+ Sim LAN Peer** or **+ Sim Wi-Fi Direct**.
3. A responsive simulated peer (e.g., `Rahul Sharma (LAN)`) will appear.
4. Open the chat to receive automated text, file transmission ACKs, and audio responses.

---

## Project Structure

```text
fasdm/
├── public/                     # Static web assets
├── src/
│   ├── components/             # UI Components
│   │   ├── collaboration/      # Real-Time Shared Collaboration Suite
│   │   │   ├── SharedChecklist.tsx   # Interactive Task Matrix & Progress Meter
│   │   │   ├── SharedStickyNotes.tsx # Freeform Draggable Sticky Notes Board
│   │   │   └── SharedWhiteboard.tsx  # HTML5 Canvas Synchronized Whiteboard
│   │   ├── AudioRecorder.tsx   # MediaRecorder, Web Audio Analyser & Waveform
│   │   ├── ChatRoom.tsx        # Direct 1-to-1 P2P Encrypted Chat Room
│   │   ├── CollaborationHub.tsx# Multi-tool Collaboration Container & Presence
│   │   ├── Dashboard.tsx       # System Overview, Metrics & Tab Navigation
│   │   ├── FileViewerModal.tsx # 3X Expanded Full-Screen Media Viewer
│   │   ├── GroupChatRoom.tsx   # Multi-Node Group Hub & Mesh Administration
│   │   ├── Navbar.tsx          # Cyberpunk Navigation Bar & Quick Indicators
│   │   ├── PeerScanner.tsx     # Discovered Devices Grid & Simulation Bar
│   │   ├── ProfileSetup.tsx    # Identity Setup & P-256 Keypair Generator
│   │   ├── SplashScreen.tsx    # Initial Animated Landing Screen
│   │   └── VoiceNotePlayer.tsx # Compact 210px Seekable Inline Audio Player
│   ├── services/               # Core Engine Services
│   │   ├── collaborationSync.ts# Real-time state hydration & conflict resolution
│   │   ├── crypto.ts           # Web Crypto API keygen, SHA-256 & QR formatting
│   │   ├── db.ts               # IndexedDB Engine Schema v4 & offline queries
│   │   └── network.ts          # P2P mesh transport & channel broadcast engine
│   ├── types/                  # TypeScript Data Models & Protocols
│   ├── App.tsx                 # Root Router & Tab View Orchestrator
│   ├── main.tsx                # React DOM Mount Entry Point
│   └── index.css               # Cyberpunk Dark Mode & Glassmorphism Design System
├── package.json
├── tsconfig.json
├── vite.config.ts
├── module_breakdown.txt        # 12-Module Formal System Specifications
└── README.md
```

---

## Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts Vite local development server at `http://localhost:3000/` with network exposure |
| `npm run build` | Runs TypeScript compilation (`tsc`) and builds optimized production bundles to `dist/` |
| `npm run preview` | Locally previews the production build |

---

## License & Credits

Developed by **Samar** for the **FasDM Mesh Project**.  
Distributed under the **MIT License**.