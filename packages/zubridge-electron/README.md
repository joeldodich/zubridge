<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./resources/zubridge-readme-hero-dark.png"/>
  <source media="(prefers-color-scheme: light)" srcset="./resources/zubridge-readme-hero-light.png"/>
  <img alt="zubridge hero image" src="./resources/zubridge-readme-hero-light.png"/>
</picture>

_streamlined state management for Electron apps_

<a href="https://www.npmjs.com/package/zubridge-electron" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/zubridge-electron" /></a>
<a href="https://www.npmjs.com/package/zubridge-electron" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/zubridge-electron" /></a>

### Why

> tldr: I want to use Zustand in my Electron app, seamlessly

[Zustand](https://github.com/pmndrs/zustand) is a great state management library. As with other state libraries [such as Redux](https://redux.js.org/tutorials/fundamentals/part-4-store#redux-store), it is [recommended](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice#recommended-patterns) that a single store is used in your app.

For Electron apps, accessing state across the main and renderer processes presents a challenge.

`zubridge-electron` solves this by enabling a single store workflow, abstracting away the IPC management and state synchronization between processes.

### Features

- Use Zustand everywhere in your Electron app
- Single store workflow across IPC boundary
- Works with the latest [Electron security recommendations](https://www.electronjs.org/docs/latest/tutorial/security#checklist-security-recommendations)
- Supports different Zustand usage patterns
- Handles thunks, inline actions or Redux-style action objects

### How It Works

`zubridge-electron` uses an additional Zustand store in the front-end (renderer) process, which is synchronized in one direction with your application store in the back-end (main) process.

Actions from the front-end are dispatched via IPC to the back-end store, which handles them and updates state accordingly. The front-end store then receives these state updates and synchronizes itself automatically.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./resources/zubridge-electron-app-architecture-dark.png"/>
  <source media="(prefers-color-scheme: light)" srcset="./resources/zubridge-electron-app-architecture-light.png"/>
  <img alt="zubridge hero image" src="./resources/zubridge-electron-app-architecture-light.png"/>
</picture>

#### Accessing The Store

- Renderer process
  - Store state can be accessed via the `useStore` hook
  - Actions & thunks can be dispatched via the `useDispatch` hook
- Main process
  - Store state can be accessed directly in the same way you normally use Zustand
  - Actions & thunks can be dispatched via the `dispatch` helper

### Getting Started

See the [docs](./docs/getting-started.md).

There are minimal example applications featuring three different Zustand usage patterns:

- [Redux-style reducers](./apps/electron/example-reducers)
- [Separate handlers](./apps/electron/example-separate-handlers)
- [Store-based handlers](./apps/electron/example-store-handlers)
