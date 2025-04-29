# electron-minimal

A sample Electron application with React and TypeScript; Built directly from the React + Typescript template provided by [electron-vite](https://electron-vite.org/guide/#scaffolding-your-first-electron-vite-project)

The notable difference between the default template and this example is that this example uses WebContentsViews inside of a BaseWindow, rather than leveraging the BrowserWindow. Here is an exceprt directly from a [blog post](https://www.electronjs.org/blog/migrate-to-webcontentsview) on electronjs.org:

> Developers ... should note that `BrowserWindow` and `WebContentsView` are subclasses inheriting from the [`BaseWindow`](https://www.electronjs.org/docs/latest/api/base-window) and [`View`](https://www.electronjs.org/docs/latest/api/view) base classes, respectively. To fully understand the available instance variables and methods, be sure to consult the documentation for these base classes.

This is done to provide a springboard example that allows developers to see how Zubridge can be used to share across multiple windows, or multiple views within a single window, with very little difference in package-related implementation details.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
