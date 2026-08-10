---
name: 'Module 2: Device Discovery & P2P Messaging'
about: Track tasks for local peer discovery, LAN WebSockets, and 1-to-1 encrypted messaging.
title: '[Feature]: Module 2 - Implement Local Device Discovery & P2P WebSockets Transport'
labels: 'enhancement, module-2'
assignees: ''
---

### Summary
With **Module 1 (Local Identity, Web Crypto P-256 Keypair, and IndexedDB Storage)** completed and pushed, we need to implement **Module 2: Device Discovery & One-to-One P2P Messaging** per SRS specifications.

### Tasks & Functional Requirements
- [ ] **FR-2 Device Discovery**: Automatically discover nearby node peers on local Wi-Fi / LAN.
- [ ] **FR-4 One-to-One Messaging**: Enable direct peer-to-peer text & emoji exchange.
- [ ] **FR-8 Read Receipts**: Implement message status indicators (`sent`, `delivered`, `read`).
- [ ] **FR-9 Typing Indicator**: Display real-time status (`"Rahul is typing..."`).
- [ ] **FR-17 Channel Selection**: Route over `LAN` -> `Wi-Fi Direct` -> `Bluetooth`.

### Acceptance Criteria
- [ ] Nearby active devices render in the "Discovered Peers" list within 5 seconds.
- [ ] LAN message latency under 500 ms.
- [ ] Messages encrypted using Module 1 Web Crypto P-256 keys and stored locally in IndexedDB.
