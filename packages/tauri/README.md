<img alt="zubridge hero image" src="https://raw.githubusercontent.com/goosewobbler/zubridge/main/resources/zubridge-hero.png"/>

_streamlined state management for Tauri apps_

<a href="https://www.npmjs.com/package/@zubridge/tauri" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/@zubridge/tauri" /></a>
<a href="https://www.npmjs.com/package/@zubridge/tauri" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/@zubridge/tauri" /></a>

### Why

> tldr: I want to use Zustand in my Tauri app, seamlessly

[Zustand](https://github.com/pmndrs/zustand) is a great state management library. As with other state libraries [such as Redux](https://redux.js.org/tutorials/fundamentals/part-4-store#redux-store), it is [recommended](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice#recommended-patterns) that a single store is used in your app.

For Tauri apps, accessing state across the main and renderer processes presents a challenge.

Zubridge solves this by enabling a single store workflow, abstracting away the IPC management and state synchronization between processes.

### Features

- Use Zustand everywhere in your Tauri app
- Single store workflow across IPC boundary
- Supports Tauri v2
- Supports different Zustand usage patterns
- Handles thunks, inline actions or Redux-style action objects

### How It Works

Zubridge uses an additional Zustand store in the front-end (renderer) process, which is synchronized in one direction with your application store in the back-end (main) process.

Actions from the front-end are dispatched via Tauri commands / events to the back-end store, which handles them and updates state accordingly. The front-end store then receives these state updates and synchronizes itself automatically.

<img alt="zubridge tauri app architecture" src="https://raw.githubusercontent.com/goosewobbler/zubridge/main/resources/zubridge-tauri-app-architecture.png"/>

### Getting Started

See the [docs](./docs/getting-started.md) to get started.
