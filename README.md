# PaleEngine

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
const world = new World('#scene-container');
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