# PaleEngine

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![WebGPU](https://img.shields.io/badge/WebGPU-Experimental-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

A modern 3D engine based on Three.js and WebGPU, using monorepo architecture with core engine and editor packages.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (version 18.0.0 or higher)
- **pnpm** (recommended package manager)
- **Modern browser** with WebGPU support (Chrome 113+, Edge 113+, or Firefox Nightly)

## Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd PaleEngineWeb
```

### 2. Install pnpm (if not already installed)

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version
```

### 3. Install Dependencies

```bash
# Install all dependencies for the entire workspace
pnpm install
```

This command will install dependencies for both the `core` and `editor` packages.

## Getting Started

### Development Mode

#### Option 1: Start the Editor (Recommended for beginners)

```bash
# Start the editor in development mode
pnpm dev:editor
```

#### Option 2: Start All Packages

```bash
# Start all packages simultaneously
pnpm dev
```

#### Option 3: Start Individual Packages

```bash
# Start only the core package
pnpm dev:core

# Start only the editor package
pnpm dev:editor
```

### Production Build

```bash
# Build all packages
pnpm build

# Build only the core package
pnpm build:core

# Build only the editor package
pnpm build:editor
```

## Usage

### 1. Using as a Library (Core Package)

```typescript
import { World, createCube, createSphere } from '@paleengine/core';

const container = document.getElementById('app');
const world = new World(container);

// Add geometries
const cube = createCube(2, 'red');
const sphere = createSphere(1, 32, 'blue');
```

### 2. Using the Default Editor

```typescript
import { World } from '@paleengine/core';

// Editor will initialize automatically
const world = new World('#workspace');
```

### 3. Custom Editor

```typescript
import { World } from '@paleengine/core';

class MyCustomEditor {
  constructor(container: HTMLElement) {
    this.engine = new World(container);
    this.setupUI();
  }
  
  private setupUI() {
    // Custom UI logic
  }
}
```

## Browser Compatibility

This project requires WebGPU support. Check compatibility at:
- Chrome 113+ (stable)
- Edge 113+ (stable)
- Firefox Nightly (experimental)

To check if your browser supports WebGPU:

```javascript
if ('gpu' in navigator) {
  console.log('WebGPU is supported!');
} else {
  console.log('WebGPU is not supported in this browser.');
}
```

## Tech Stack

- **TypeScript**: Type-safe JavaScript
- **Three.js**: 3D graphics library
- **WebGPU**: Modern graphics API
- **Vite**: Fast build tool
- **pnpm**: Efficient package manager

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

### What this means:

- ✅ **Free to use**: You can run, study, and modify the software
- ✅ **Free to distribute**: You can share copies of the software
- ✅ **Free to improve**: You can distribute modified versions
- ⚠️ **Copyleft**: Modified versions must also be GPL-3.0 licensed
- ⚠️ **Source required**: You must provide source code when distributing

For more information about GPL-3.0, visit: https://www.gnu.org/licenses/gpl-3.0.html

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. By contributing to this project, you agree that your contributions will be licensed under the same GPL-3.0 license.