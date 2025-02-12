<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./resources/zubridge-readme-hero-dark.png"/>
  <source media="(prefers-color-scheme: light)" srcset="./resources/zubridge-readme-hero-light.png"/>
  <img alt="zubridge hero image" src="./resources/zubridge-readme-hero-light.png"/>
</picture>

_streamlined state management for cross-platform apps_

<a href="https://www.npmjs.com/package/zubridge-electron" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/zubridge-electron" /></a>
<a href="https://www.npmjs.com/package/zubridge-electron" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/zubridge-electron" /></a>
<a href="https://www.npmjs.com/package/zubridge-tauri" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/zubridge-tauri" /></a>
<a href="https://www.npmjs.com/package/zubridge-tauri" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/zubridge-tauri" /></a>

### Why

> tldr: I want to use Zustand in my cross-platform app, seamlessly

[Zustand](https://github.com/pmndrs/zustand) is a great state management library. As with other state libraries [such as Redux](https://redux.js.org/tutorials/fundamentals/part-4-store#redux-store), it is [recommended](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice#recommended-patterns) that a single store is used in your app.

For cross-platform apps, accessing state across the main and renderer processes presents a challenge.

Zubridge solves this by enabling a single store workflow, abstracting away the IPC management and state synchronization between processes.

### Features

- Use Zustand everywhere in your cross-platform app
- Single store workflow across IPC boundary
- Supports Electron and Tauri
- Supports different Zustand usage patterns
- Handles thunks, inline actions or Redux-style action objects

### How It Works

Zubridge uses an additional Zustand store in the front-end (renderer) process, which is synchronized in one direction with your application store in the back-end (main) process.

Actions from the front-end are dispatched via IPC (Electron) or commands / events (Tauri) to the back-end store, which handles them and updates state accordingly. The front-end store then receives these state updates and synchronizes itself automatically.

### Getting Started

Zubridge is available for both Electron and Tauri apps. See the [Electron docs](./packages/zubridge-electron/docs/getting-started.md) or [Tauri docs](./packages/zubridge-tauri/docs/getting-started.md) to get started.

### Framework Support

Zubridge is available for multiple cross-platform application frameworks:

#### Electron

Install `zubridge-electron` for Electron applications.

Uses Electron's built-in IPC system with minimal configuration required.

#### Tauri

Install `zubridge-tauri` for Tauri v2 applications, or `zubridge-tauri-v1` for Tauri v1.

Uses Tauri's event system and commands, respecting its security model where main process actions must be explicitly allowed.

### Inspiration / Prior Art

This project would not exist without Reduxtron, shout out to vitordino for creating it!

- [vitordino/reduxtron](https://github.com/vitordino/reduxtron)

  - Redux store in the main process, optionally synced to Zustand in the renderer
  - zubridge-electron is based on Reduxtron
  - Great for Redux users, not an option if you want to use Zustand everywhere

- [klarna/electron-redux](https://github.com/klarna/electron-redux)
  - Bi-directional sync between one Redux store in the main process, and another in the renderer
  - No longer maintained
  - I created [a fork](https://github.com/goosewobbler/electron-redux) to enable support for [electron >= 14](https://github.com/klarna/electron-redux/issues/317), however I won't be spending any more time on this approach
