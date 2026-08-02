# Void Runner

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![npm version](https://img.shields.io/npm/v/void-runner.svg)](https://www.npmjs.com/package/void-runner)

A 3D retro-futuristic headset-less VR runner game built with **React**, **TypeScript**, and **Google MediaPipe**, controlled entirely in the browser using AI camera vision gesture tracking. Available as an **npm component package** and standalone web app.

---

## Installation

Install the package via npm:

```bash
npm install void-runner
```

or yarn / pnpm:

```bash
yarn add void-runner
# or
pnpm add void-runner
```

---

## Plug and Play Usage

Import `<VoidRunner />` and its CSS bundle into your React, Next.js, Vite, or Remix application:

```tsx
import { VoidRunner } from 'void-runner';
import 'void-runner/dist/styles.css';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <VoidRunner
        onExit={() => console.log('Player exited back to main menu')}
        onGameOver={(finalScore, coins) => {
          console.log(`Game Over! Final Score: ${finalScore}, Coins: ${coins}`);
        }}
        onScoreChange={(score) => {
          console.log('Current score:', score);
        }}
      />
    </div>
  );
}
```

---

## Component Props API

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `onExit` | `() => void` | `undefined` | Callback fired when the user clicks the "BACK" button in the menu. |
| `onGameOver` | `(finalScore: number, coins: number) => void` | `undefined` | Callback fired when player runs out of health. |
| `onScoreChange` | `(score: number) => void` | `undefined` | Callback fired as distance/points accumulate. |
| `className` | `string` | `""` | Additional CSS class names for the container. |
| `style` | `React.CSSProperties` | `{}` | Inline CSS styles for the container. |

---

## Key Features

### 3D Headset-Less VR & Gesture AI Controls
* **Webcam Gesture AI**: Powered by Google MediaPipe (`face_mesh`, `hands`).
  * **Head Steering**: Lean your head left or right to switch lanes.
  * **Head Jump**: Raise your head above the threshold to jump over obstacles.
  * **Hand Sword Slasher**: Raise your hand in SWORD MODE to summon a laser blade and slash targets in mid-air.
* **Fallback Controls**:
  * **Touch Screen**: Tap sides to swap lanes, tap top half to jump, swipe to slice.
  * **Keyboard**: `A`/`D` or Arrow keys to steer, `W` / `Space` to jump.

---

## Local Development

To run the repository locally or contribute:

### 1. Clone & Install
```bash
git clone https://github.com/code-dibyajyotirout/void-runner-npm-package.git
cd void-runner-npm-package
npm install
```

### 2. Run Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build npm Library Bundle
```bash
npm run build:lib
```
Generates CJS, ESM, TypeScript `.d.ts`, and bundled CSS into `./dist`.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** - see the [LICENSE](LICENSE) file for details.
