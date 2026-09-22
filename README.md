# FlexNote

A flexible, modern note-taking application built with Tauri 2 and Vue 3.

<img width="1920" height="1009" alt="image" src="https://github.com/user-attachments/assets/fea38ab6-d9c4-46f8-a23c-21b4042b4fd7" />
<img width="1626" height="809" alt="image" src="https://github.com/user-attachments/assets/b3c17e51-a3aa-4220-b224-886d350bc30d" />
<img width="1920" height="1009" alt="image" src="https://github.com/user-attachments/assets/1a0b1045-7592-4b63-999d-4f8a1fe0939f" />

## Features

- **Rich Text Editing** - Powered by TipTap with support for:
  - Tables, task lists, code blocks with syntax highlighting
  - Math equations (KaTeX), images, links, and more
- **Cross-Platform** - Native desktop app for Windows, macOS, and Linux
- **Lightweight** - Built with Tauri for minimal resource usage
- **Local First** - Your notes stay on your device

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3 + TypeScript + Vite |
| Backend | Rust + Tauri 2 |
| Editor | TipTap (ProseMirror) |
| State | Pinia |
| Math | KaTeX |
| Syntax | lowlight |

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

## Getting Started

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/flexnote.git
cd flexnote
npm install
```

### Development

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
flexnote/
├── src/                  # Vue frontend
│   ├── components/       # UI components
│   ├── services/         # Business logic
│   ├── stores/           # Pinia stores
│   └── utils/            # Utilities
├── src-tauri/            # Rust backend
│   ├── src/              # Rust source
│   └── tauri.conf.json   # Tauri config
├── docs/                 # Documentation
└── public/               # Static assets
```

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
