# MECHA CLASH

> **A fast-paced, cybernetic 2D top-down mecha arena combat game built with React 19, TypeScript, HTML5 Canvas, WebSockets, and Tailwind CSS.**

Pilot the high-agility combat chassis **VEX** against **NOVA**, an adaptive neural-network combat AI, or duel friends over the internet in **Real-Time Online Multiplayer**. Master directional movement, precision energy-blade slashes, tactical burst dashes with invulnerability frames (i-frames), omnidirectional **360° Energy Burst Ultimates**, and arena power-ups while battling across multi-stage **Boss Phases** and dynamic environmental hazards.

---

## 🚀 Key Features

### 🌐 Real-Time Online Multiplayer (1v1 Cross-Device)
- **Room Creation**: Host matches and generate a unique, short, easy-to-share 5-character room code (e.g., `7K4P2`).
- **Room Joining**: Opponents on any device (phone, laptop, desktop) join by entering the room code.
- **Cross-Platform & Cross-Network Play**: Works seamlessly across different networks (e.g. Player 1 on Laptop Wi-Fi, Player 2 on Mobile Data).
- **Sub-50ms State Synchronization**:
  - Continuous 20Hz throttled movement synchronization with smooth interpolation (no teleportation or stuttering).
  - Synchronized attacks, blade sweeps, dash thrusters, and 360° Energy Bursts.
  - Server-verified damage calculation, hull hit stun, shield deflection, and knockback impulses.
- **Dynamic Power-Up Spawning**: Synchronized power-up drops (Shield, 2× Damage, Speed Boost, Repair, Energy) spawned and collected in real time.
- **Best-of-3 Match Flow**: 2 round wins to claim victory, accompanied by round end overlays, victory/defeat cards, mutual rematch requests, and opponent disconnection recovery.

### ⚔️ Combat System & Ultimate Mechanics
- **Energy-Blade Slash**: Close-quarters arc sweep attack with hit stun, reach calculations, and power strike multipliers.
- **Burst Dash & I-Frames**: Tactical thruster dash providing invulnerability frames (`i-frames`) to weave through incoming slashes and laser barriers.
- **360° Energy Burst (Ultimate)**:
  - Radial shockwave discharge dealing high damage and strong radial knockback.
  - Grants temporary invulnerability during activation to escape lethal pinches.
  - Dedicated cooldown gauge with visual particle shockwaves and audio cues.
- **Damage & Armor Dynamics**: Health management (`100 HP`), 3 lives per match, hit stun frames, invulnerability recovery windows, and shield damage absorption.

### 🤖 Mecha Types & Boss Phases
- **VEX (Player Unit)**: High-agility striker equipped with twin thrusters, plasma blade emitters, and the radial Energy Burst core.
- **NOVA (AI Combatant)**: Adaptive machine intelligence with multiple combat chassis types and personality configurations:
  - **Chassis Archetypes**:
    - **Balanced Sentinel**: Calculated spacing, standard reach, and adaptive counters.
    - **Brawler**: High aggression, relentless close-quarters pursuit, and quick punish windows.
    - **Flanker**: High-speed circling, diagonal thruster bursts, and bait tactics.
    - **Kiter**: Distance-keeping, zone control, and opportunistic strikes.
    - **Apex Overlord**: Master-tier AI combining predictive movement, frame-perfect dodges, and aggressive power-up denial.
  - **Boss Tiers & Multi-Phase Encounters**:
    - **Mini-Bosses** (e.g., *Level 10 Prototype Sentinel*): Enhanced HP pools and aggressive dash patterns.
    - **Boss Chassis** (e.g., *NOVA STRIKER*, *NOVA WARLORD*): Multi-round stamina, dynamic barrier activation, and faster attack cycles.
    - **Major & Final Bosses** (e.g., *Level 40 Cyber Titan*, *Level 50 APEX NOVA*): Screen-shaking strikes, dynamic phase shifts, laser grid overloads, and high armor scaling.

### 🎮 Game Modes
1. **Quick Duel**: Instant single-match arena duel across 5 difficulty levels (`NORMAL`, `MEDIUM`, `HARD`, `EXTREME_HARD`, `HARDCORE`).
2. **50-Level Campaign**: Spans 5 distinct thematic chapters with progressive difficulty, level briefings, unique arena layouts, and boss encounters:
   - **Chapter 1: Awakening** (Levels 1–10 • Cyan Matrix Theme)
   - **Chapter 2: Rising Threat** (Levels 11–20 • Neon Purple Theme)
   - **Chapter 3: War Machine** (Levels 21–30 • Crimson Forge Theme)
   - **Chapter 4: Cyber Siege** (Levels 31–40 • Emerald Nexus Theme)
   - **Chapter 5: Apex Overlord** (Levels 41–50 • Gold Core Theme)
3. **Endless Survival**: Fight an endless succession of increasingly lethal AI opponents with persistent score tracking and difficulty scaling.

### ⚡ Arena Hazards & Power-Ups
- **Battlefield Hazards**:
  - **Collapsing Platforms**: Tactical floor panels that flash warnings before collapsing into lethal voids.
  - **Moving Laser Barriers**: Sweeping horizontal and vertical energy beams that damage units on contact.
  - **Hazard Nodes**: Timed pulsing electrical zones.
- **Combat Pickups**:
  - `SPEED_BOOST`: Increases thruster velocity to 300 px/sec.
  - `SHIELD`: Complete damage negation for one attack or hazard impact.
  - `POWER_ATTACK`: 2× damage output on the next blade slash.
  - `HEAL`: Restores critical hull integrity (+25 HP).
  - `ENERGY`: Instantly refreshes Dash and Ultimate cooldowns.

### 📱 Responsive Desktop & Mobile Experience
- **Desktop Controls**: Full keyboard (WASD / Arrows / Space / F / G) and mouse support.
- **Mobile Virtual Controller**: Ergonomic virtual analog joystick on the left; prominent action buttons (`ATTACK`, `DASH`, `BURST`) on the right.
- **Mobile HUD Utilities**:
  - Real-time battery status and charging monitor updating every 30 seconds for session management.
  - Compact 36×36px top-right toggle button utilizing standard Fullscreen API and landscape orientation lock.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **[React 19](https://react.dev/)** | Component-driven UI, state management, and modal overlays |
| **[TypeScript](https://www.typescriptlang.org/)** | Strict type safety for game state, collision math, and network protocol |
| **[WebSockets (ws)](https://github.com/websockets/ws)** | Low-latency real-time multiplayer server & client room protocol |
| **[Express 4](https://expressjs.com/)** | Full-stack server hosting WebSocket server and Vite middleware |
| **[Vite 8](https://vitejs.dev/)** | Next-generation frontend tooling and fast HMR development server |
| **[Tailwind CSS v4](https://tailwindcss.com/)** | Modern utility-first styling with `@tailwindcss/vite` |
| **HTML5 Canvas 2D API** | Custom high-performance 60 FPS renderer with camera shake and particle systems |
| **Web Audio API** | 100% procedural sound effects synthesis (zero external audio file dependencies) |
| **[Lucide React](https://lucide.dev/)** | Clean, minimalist icons for HUD and menu interfaces |
| **[Motion](https://motion.dev/)** | Smooth UI transitions and menu animations |

---

## 📁 Project Structure

```text
mecha-clash/
├── server.ts                  # Express HTTP server + WebSocket real-time room engine
├── index.html                 # HTML5 entry point with safe-area meta tags
├── package.json               # Scripts, project dependencies, and metadata
├── vite.config.ts             # Vite build configuration (React & Tailwind v4 plugins)
├── tsconfig.json              # TypeScript compiler settings
├── metadata.json              # Applet metadata, permissions, and capabilities
├── .env.example               # Example environment variable template
└── src/
    ├── main.tsx               # React application mounting point
    ├── App.tsx                # Primary view router (Menu, Multiplayer, Campaign, Game)
    ├── index.css              # Global styles, fonts, and Tailwind directives
    ├── audio/
    │   └── soundManager.ts    # Procedural Web Audio API sound synthesizer
    ├── components/
    │   ├── MultiplayerLobby.tsx # Room creation, room joining, code sharing, status
    │   ├── MultiplayerModal.tsx # Match victory/defeat results, rematch, opponent DC
    │   ├── CampaignSelect.tsx # 50-level campaign mission selection map
    │   ├── CountdownOverlay.tsx # Pre-round countdown HUD (3... 2... 1... FIGHT!)
    │   ├── DefeatModal.tsx    # Defeat recap with retry and menu navigation
    │   ├── DifficultySelect.tsx # Quick Duel tier selection (Normal to Hardcore)
    │   ├── GameCanvas.tsx     # Game loop runner, canvas mount, and touch overlay
    │   ├── HowToPlay.tsx      # Comprehensive combat primer and controls guide
    │   ├── HUD.tsx            # Real-time health gauges, mobile battery monitor & controls
    │   ├── MainMenu.tsx       # Landing screen with mode selection & audio toggles
    │   ├── PauseModal.tsx     # In-game pause menu with restart & resume options
    │   ├── RoundEndOverlay.tsx# Dynamic round win/loss transition banner
    │   ├── VictoryModal.tsx   # Victory recap with match stats and progression
    │   └── VirtualControls.tsx# Virtual analog thumbstick and tactile action triggers
    ├── game/
    │   ├── constants.ts       # Combat tuning values, colors, chapters, and arena geometry
    │   ├── engine.ts          # Core game loop, multiplayer lerp, combat physics, damage sync
    │   ├── ai.ts              # Adaptive AI controller (5 personality archetypes)
    │   └── renderer.ts        # 60 FPS Canvas 2D graphics engine and particle rendering
    ├── network/
    │   └── multiplayerClient.ts # Resilient WebSocket client with auto-reconnect & state sync
    ├── types/
    │   ├── game.ts            # Type definitions for entities, obstacles, hazards, and buffs
    │   └── multiplayer.ts     # Client/Server network protocol message schemas
    └── utils/
        └── fullscreen.ts      # Cross-browser mobile Fullscreen & landscape orientation helper
```

---

## ⚙️ Installation & Setup

Follow these steps to run **MECHA CLASH** locally:

### 1. Prerequisites
- **Node.js**: `v18.x`, `v20.x`, or higher
- **npm**: `v9.x` or higher (bundled with Node.js)

### 2. Clone the Repository
```bash
git clone https://github.com/Sarthak-850/mecha-clash.git
cd mecha-clash
```

### 3. Install Dependencies
```bash
npm install
```

---

## ▶️ Running the Project

### Development Server
Start the local Vite development server at `http://localhost:3000`:
```bash
npm run dev
```

### Production Build
Compile TypeScript and generate an optimized production bundle in the `dist` directory:
```bash
npm run build
```

### Preview Production Build
Serve the compiled production bundle locally to test final performance:
```bash
npm run preview
```

### Type Checking & Linting
Validate the codebase for TypeScript errors:
```bash
npm run lint
```

---

## 🔑 Environment Variables (Gemini API)

MECHA CLASH runs completely client-side in the browser. When integrating server-side or extended AI features using the Google Gen AI SDK (`@google/genai`), configure your environment variables:

1. Copy `.env.example` to create a local `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Configure the following variables in `.env`:
   ```env
   # GEMINI_API_KEY: Required for server-side Gemini AI API interactions.
   # In Google AI Studio, this is automatically injected via the Secrets panel.
   GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

   # APP_URL: The hosting domain or Cloud Run service URL.
   APP_URL="http://localhost:3000"
   ```

> **Security Note:** Never commit your actual `.env` file or expose secret API keys to public repositories.

---

## 🎮 How to Play

### Controls Reference

| Action | Desktop Keyboard | Mouse / Touch Controls |
|---|---|---|
| **Move Up / Down / Left / Right** | `W`, `A`, `S`, `D` / Arrow Keys | Virtual Analog Joystick (Mobile) |
| **Energy Slash (Attack)** | `F` | Left Mouse Click / `ATTACK` Touch Button |
| **Burst Dash (i-frames)** | `G` | Right Mouse Click / `DASH` Touch Button |
| **Energy Burst (Ultimate)** | `Space` | `BURST` Touch Button |
| **Pause Game** | `P` or `Escape` | `PAUSE` HUD Button |
| **Mute / Unmute Audio** | `M` | Volume Icon in HUD |

### Combat Tactics
1. **Bait & Punish**: Watch for NOVA's dash cooldown. When NOVA dashes forward, use your own dash to phase through the attack using i-frames, then turn and strike.
2. **Control the Center**: When power-ups spawn, contest them early. Denying NOVA a `SHIELD` or `2× ATK` buff is often the difference between victory and defeat.
3. **Time Your Ultimate**: Save your **Energy Burst (`Space`)** for moments when you are cornered against arena barriers or when NOVA initiates a high-damage combo.
4. **Watch the Arena**: In Chapters 3 through 5, hazardous laser grids and collapsing platforms can deplete your HP faster than enemy attacks. Keep note of warning indicators before platforms collapse!

---

## 📸 Screenshots

```text
+-----------------------------------------------------------------------+
|  [ VEX (PLAYER) ]                 RND 1               [ NOVA (AI) ]  |
|  HP: |||||||||||| 100/100      SCORE: 2,400       HP: |||||||||| 80   |
|                                                                       |
|                          ⚡ [POWER-UP SPAWN]                           |
|                                                                       |
|           ( VEX )                                  ( NOVA )           |
|              \====> [ENERGY BLADE SLASH]              /               |
|                                                                       |
|                                                (=== LASER BEAM ===)   |
|                                                                       |
|  [JOYSTICK]                                     [BURST] [DASH] [ATK]  |
+-----------------------------------------------------------------------+
```

---

## 🌐 Deployment

Because **MECHA CLASH** builds into standard static HTML/JS/CSS assets, it can be deployed to any static host:

### Deploy to Vercel
```bash
npm install -g vercel
vercel
```

### Deploy to Netlify
```bash
npm run build
# Set the publish directory to "dist"
```

### Deploy to GitHub Pages
```bash
npm run build
npx gh-pages -d dist
```

---

## 🤝 Contributing

Contributions, feature suggestions, and bug reports are welcome!

1. Fork the Project.
2. Create a Feature Branch (`git checkout -b feature/EpicMechaUpgrade`).
3. Commit your Changes (`git commit -m "Add new plasma rifle weapon type"`).
4. Push to the Branch (`git push origin feature/EpicMechaUpgrade`).
5. Open a Pull Request.

---

## 📄 License

This project is open-source. Please credit the original author when referencing or utilizing code from this repository.

---

## 👨‍💻 Author

**Sarthak Raikwar**  
GitHub: [@Sarthak-850](https://github.com/Sarthak-850)
