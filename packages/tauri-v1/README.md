<picture>
  <img alt="zubridge hero image" src="../../resources/zubridge-hero.png"/>
</picture>

_streamlined state management for Tauri v1 apps_

<a href="https://www.npmjs.com/package/@zubridge/tauri-v1" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/@zubridge/tauri-v1" /></a>
<a href="https://www.npmjs.com/package/@zubridge/tauri-v1" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/@zubridge/tauri-v1" /></a>

### Why

> tldr: I want to use Zustand in my Tauri v1 app, seamlessly

[Zustand](https://github.com/pmndrs/zustand) is a great state management library. As with other state libraries [such as Redux](https://redux.js.org/tutorials/fundamentals/part-4-store#redux-store), it is [recommended](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice#recommended-patterns) that a single store is used in your app.

For Tauri apps, accessing state across the main and renderer processes presents a challenge.

Zubridge solves this by enabling a single store workflow, abstracting away the IPC management and state synchronization between processes.

### Features

- Use Zustand everywhere in your Tauri v1 app
- Single store workflow across IPC boundary
- Supports different Zustand usage patterns
- Handles thunks, inline actions or Redux-style action objects

### How It Works

Zubridge uses an additional Zustand store in the front-end (renderer) process, which is synchronized in one direction with your application store in the back-end (main) process.

Actions from the front-end are dispatched via Tauri commands / events to the back-end store, which handles them and updates state accordingly. The front-end store then receives these state updates and synchronizes itself automatically.

### Getting Started

See the [docs](./packages/@zubridge/tauri-v1/docs/getting-started.md) to get started.

Note that this package only supports Tauri v1. If you need Tauri v2 support, see the [@zubridge/tauri](https://github.com/goosewobbler/@zubridge/electron/tree/main/packages/@zubridge/tauri) package.
