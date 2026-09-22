# Contributing to FlexNote

Thank you for your interest in contributing to FlexNote! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

### Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/flexnote.git
   cd flexnote
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start development server:

   ```bash
   npm run tauri dev
   ```

## Making Changes

1. Create a new branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit with clear messages:

   ```bash
   git commit -m "feat: add new feature description"
   ```

3. Push to your fork and open a Pull Request.

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style/formatting
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

## Code Style

- **Frontend**: TypeScript + Vue 3 `<script setup>` syntax
- **Backend**: Rust with standard formatting (`cargo fmt`)
- Run `npm run build` before submitting to ensure no type errors

## Reporting Issues

When reporting issues, please include:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- System information (OS, Node/Rust versions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.