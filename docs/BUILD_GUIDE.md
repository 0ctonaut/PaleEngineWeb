# PaleEngine Build Guide

This document explains the complete build process, toolchain configuration, and automated deployment setup for the PaleEngine project.

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Build Toolchain Overview](#build-toolchain-overview)
3. [File Types and Their Roles](#file-types-and-their-roles)
4. [Complete Build Process](#complete-build-process)
5. [Core Package Build](#core-package-build)
6. [Editor Package Build](#editor-package-build)
7. [GitHub Actions Deployment](#github-actions-deployment)
8. [Configuration Files Explained](#configuration-files-explained)
9. [Troubleshooting](#troubleshooting)

## Project Architecture

PaleEngine uses a **monorepo structure** with two main packages:

```
PaleEngineWeb/
├── core/                    # Core engine library
│   ├── src/                # TypeScript source code
│   ├── dist/               # Built library files
│   ├── package.json        # Library configuration
│   ├── tsconfig.json       # TypeScript configuration
│   └── vite.config.ts      # Vite build configuration
├── editor/                  # Web application
│   ├── src/                # TypeScript source code
│   ├── dist/               # Built web app files
│   ├── index.html          # Entry HTML file
│   ├── package.json        # App configuration
│   ├── tsconfig.json       # TypeScript configuration
│   └── vite.config.ts      # Vite build configuration
├── .github/workflows/       # GitHub Actions
│   └── deploy.yml          # Auto-deployment workflow
└── package.json            # Root workspace configuration
```

### Package Roles

| Package | Type | Purpose | Output |
|---------|------|---------|--------|
| **core** | Library | 3D engine functionality | `.mjs` + `.d.ts` files |
| **editor** | Web App | User interface | HTML + JS + CSS |

## Build Toolchain Overview

The build process uses two main tools working together:

### TypeScript Compiler (tsc)
- **Role**: Type checking and declaration file generation
- **Input**: `.ts` source files
- **Output**: `.d.ts` type declaration files (and `.js` files)
- **Configuration**: `tsconfig.json`

### Vite Build Tool
- **Role**: Code bundling, optimization, and asset processing
- **Input**: `.ts` source files
- **Output**: `.mjs` JavaScript modules and static assets
- **Configuration**: `vite.config.ts`

### Tool Division of Labor

```
TypeScript (tsc)          Vite
     ↓                     ↓
Type checking + .d.ts   Runtime code + bundling
     ↓                     ↓
Development use        Production use
```

### Understanding `tsc` vs `tsc --build`

This project uses **TypeScript Composite Projects** (`composite: true` in `tsconfig.json`), which requires understanding two different TypeScript compilation modes:

#### Regular `tsc` Command
```bash
tsc  # Standard compilation
```
- Works well for simple projects
- Basic incremental compilation
- No project reference support

#### Build Mode `tsc --build`
```bash
tsc --build  # Composite project mode
```
- **Required for composite projects** (projects with `composite: true`)
- Handles project references correctly
- Advanced incremental compilation with `.tsbuildinfo` cache
- Additional commands:
  - `tsc --build --clean` - Remove all build outputs
  - `tsc --build --force` - Force rebuild ignoring cache

**Why we use `tsc --build`:** Our monorepo uses composite projects to enable project references (editor references core). The `tsc --build` command ensures:
- ✅ Declaration files are always generated
- ✅ Project dependencies are built in correct order
- ✅ Incremental compilation works reliably
- ✅ Build cache is managed properly

## File Types and Their Roles

### Source Files
- **`.ts`**: TypeScript source code (what you write)
- **`.html`**: Entry HTML file for web applications

### Generated Files
- **`.d.ts`**: Type declaration files (for TypeScript type checking)
- **`.mjs`**: ES Module JavaScript files (for runtime execution)
- **`.d.ts.map`**: Source maps for type declarations
- **`.tsbuildinfo`**: TypeScript incremental compilation cache

### Output Directory
- **`dist/`**: Contains all build artifacts ready for distribution

### Understanding Build Cache Files

#### `.tsbuildinfo` Files

These files are created by TypeScript when using composite projects:

```
core/
├── src/
├── dist/
└── tsconfig.tsbuildinfo  ← Build cache
```

**Purpose:**
- Stores compilation state and configuration
- Enables fast incremental compilation
- Tracks file dependencies and timestamps

**Important:** When you modify `tsconfig.json`, the cache may become outdated. Use `tsc --build --clean` to remove it.

**Why it matters:**
- ✅ Speeds up repeated builds significantly
- ⚠️ Can cause issues if not cleaned after config changes
- ⚠️ Simply deleting `dist/` doesn't remove this cache

#### Cleaning Strategy

| What to Delete | Command | When to Use |
|----------------|---------|-------------|
| **Output files only** | `rm -rf dist/` | Quick cleanup (not recommended) |
| **Complete cleanup** | `tsc --build --clean` | After config changes (recommended) |
| **All packages** | `pnpm clean` | Project-wide cleanup |

### File Purpose Summary

| File Type | Purpose | Used By | Example |
|-----------|---------|---------|---------|
| `.ts` | Source code | Developers | `src/index.ts` |
| `.d.ts` | Type information | TypeScript compiler | `dist/index.d.ts` |
| `.mjs` | Executable code | Browser/Node.js | `dist/index.mjs` |
| `dist/` | Build output | Deployment | All final files |

## Complete Build Process

### High-Level Flow

```
Source Code (.ts)
    ↓
TypeScript Compiler (tsc)
    ↓
Type Declarations (.d.ts)
    ↓
Vite Build Tool
    ↓
Final Output (dist/)
```

### Detailed Steps

1. **TypeScript Compilation**
   - Reads `tsconfig.json` configuration
   - Performs type checking
   - Generates `.d.ts` declaration files

2. **Vite Bundling**
   - Reads `vite.config.ts` configuration
   - Transpiles TypeScript to JavaScript
   - Bundles modules and dependencies
   - Optimizes and minifies code
   - Processes static assets

3. **Output Generation**
   - All files placed in `dist/` directory
   - Ready for distribution or deployment

## Core Package Build

The `core` package is built as a **library** for use by other projects.

### Build Command
```bash
pnpm build:core
# Equivalent to: pnpm --filter @paleengine/core build
```

### Build Process

1. **TypeScript Compilation**
   ```bash
   tsc --build  # Note: --build flag is required for composite projects
   ```
   - Generates: `core/dist/index.d.ts`
   - Generates: `core/dist/components/*.d.ts`
   - Generates: `core/dist/engine/*.d.ts`
   - Generates: `core/dist/systems/*.d.ts`
   - Also generates: `.js` files (will be overwritten by Vite)
   - Updates: `core/tsconfig.tsbuildinfo` (build cache)

2. **Vite Library Build**
   ```bash
   vite build  # Reads core/vite.config.ts
   ```
   - Generates: `core/dist/index.mjs` (overwrites `.js` from step 1)
   - Bundles all dependencies
   - Externalizes `three` and `three/webgpu`
   - Preserves `.d.ts` files (thanks to `emptyOutDir: false`)

**Key Point:** The `tsc --build` command (not just `tsc`) is essential because our project uses `composite: true`. This ensures declaration files are properly generated every time.

### Core Configuration

#### `core/tsconfig.json`
```json
{
  "compilerOptions": {
    "composite": true,              // Enable project references
    "rootDir": "src",               // Source directory
    "outDir": "dist",               // Output directory
    "declaration": true,            // Generate declaration files
    "declarationMap": true          // Generate source maps
  }
}
```

**Key Configuration Explained:**

- **`composite: true`**: Enables TypeScript Project References
  - Allows other projects to reference this one (editor references core)
  - **Requires** using `tsc --build` instead of `tsc`
  - Automatically enables `declaration: true`
  - Generates `.tsbuildinfo` for incremental compilation
  
- **`rootDir: "src"`**: Ensures flat output structure
  - Result: `dist/index.d.ts` (not `dist/src/index.d.ts`)
  
- **Why we removed `emitDeclarationOnly`**: 
  - This option can fail silently with composite projects
  - Instead, we let TypeScript generate both `.js` and `.d.ts`
  - Vite then overwrites the `.js` files while preserving `.d.ts`

#### `core/vite.config.ts`
```typescript
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'PaleEngineCore',
      fileName: 'index',
      formats: ['es']               // ES Module format
    },
    rollupOptions: {
      external: ['three', 'three/webgpu'],  // External dependencies
    },
    outDir: 'dist',
    emptyOutDir: false              // Preserve tsc-generated files
  }
})
```

### Final Core Output
```
core/dist/
├── index.mjs           # Main library file
├── index.d.ts          # Type declarations
├── index.d.ts.map      # Source maps
├── components/
│   └── index.d.ts      # Component types
├── engine/
│   └── index.d.ts      # Engine types
└── systems/
    └── index.d.ts      # System types
```

## Editor Package Build

The `editor` package is built as a **web application** for browser deployment.

### Build Command
```bash
pnpm build:editor
# Equivalent to: pnpm --filter @paleengine/editor build
```

### Build Process

1. **TypeScript Type Checking**
   ```bash
   tsc  # Reads editor/tsconfig.json
   ```
   - Performs type checking
   - Reads `core/dist/*.d.ts` for type information
   - Does NOT generate files (`noEmit: true`)

2. **Vite Application Build**
   ```bash
   vite build  # Reads editor/vite.config.ts
   ```
   - Generates: `editor/dist/index.html`
   - Generates: `editor/dist/assets/*.js`
   - Generates: `editor/dist/assets/*.css`
   - Bundles all dependencies including `@paleengine/core`

### Editor Configuration

#### `editor/tsconfig.json`
```json
{
  "compilerOptions": {
    "noEmit": true,                 // Don't generate files (Vite handles this)
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "references": [{ "path": "../core" }]  // Reference core package
}
```

**Note**: Editor uses `noEmit: true` because it's a web application, not a library. It only needs type checking, not declaration file generation.

#### `editor/vite.config.ts`
```typescript
export default defineConfig({
  base: process.env.NODE_ENV === 'production' 
    ? '/PaleEngineWeb/' : '/',     // GitHub Pages base path
  build: {
    outDir: 'dist',
    emptyOutDir: false              // Preserve tsc-generated files
  },
  resolve: {
    dedupe: ['three', 'three/webgpu']
  }
})
```

### Final Editor Output
```
editor/dist/
├── index.html           # Entry HTML file
└── assets/
    ├── index-xxx.js     # Bundled JavaScript
    └── index-xxx.css    # Bundled CSS
```

## GitHub Actions Deployment

Automated deployment using GitHub Actions and GitHub Pages.

### Workflow File: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]           # Trigger on main branch pushes
  workflow_dispatch:             # Allow manual triggers

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'      # Required for Vite 7+

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Build core package
        run: pnpm build:core

      - name: Build editor package
        run: pnpm build:editor

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: editor/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Deployment Process

1. **Trigger**: Push to `main` branch or manual trigger
2. **Build Environment**: Ubuntu with Node.js 22 and pnpm
3. **Build Steps**:
   - Install dependencies
   - Build core package (generates `.d.ts` files)
   - Build editor package (uses core types)
4. **Deployment**: Upload to GitHub Pages artifact storage
5. **Result**: Website available at `https://0ctonaut.github.io/PaleEngineWeb/`

### GitHub Pages Configuration

In repository settings:
- **Source**: GitHub Actions
- **Branch**: Not applicable (uses artifact storage)
- **Custom domain**: Optional

## Configuration Files Explained

### Key TypeScript Options

| Option | Purpose | Core | Editor |
|--------|---------|------|--------|
| `composite` | Enable project references | ✅ | ❌ |
| `declaration` | Generate .d.ts files | ✅ | ❌ |
| `rootDir` | Source directory | `src` | - |
| `outDir` | Output directory | `dist` | - |
| `noEmit` | Don't generate files | ❌ | ✅ |
| `declarationMap` | Generate source maps | ✅ | ❌ |

### Key Vite Options

| Option | Purpose | Core | Editor |
|--------|---------|------|--------|
| `build.lib` | Build as library | ✅ | ❌ |
| `build.outDir` | Output directory | `dist` | `dist` |
| `build.emptyOutDir` | Clear output directory | `false` | `false` |
| `base` | Base path for deployment | ❌ | `/PaleEngineWeb/` |

### Why These Settings?

1. **`emptyOutDir: false`**: Prevents Vite from deleting tsc-generated `.d.ts` files
2. **`rootDir: "src"`**: Ensures flat output structure (`dist/index.d.ts` not `dist/src/index.d.ts`)
3. **`composite: true`**: Enables project references for better build performance (core only)
4. **`noEmit: true`**: Editor only needs type checking, not file generation
5. **No `emitDeclarationOnly`**: This option can cause issues with composite projects

## Understanding TypeScript Composite Projects

This section explains the `composite: true` configuration and its implications.

### What are Composite Projects?

Composite Projects are TypeScript's solution for managing large codebases split into multiple packages. They enable:

```json
// editor/tsconfig.json
{
  "references": [{ "path": "../core" }]  // Editor depends on core
}
```

This tells TypeScript: "Editor needs types from core, build core first."

### Benefits of Composite Projects

1. **Explicit Dependencies**: Clear project relationships
2. **Incremental Compilation**: Only rebuild what changed
3. **Better IDE Performance**: Faster type checking
4. **Build Orchestration**: Correct build order automatically

### How Composite Projects Change TypeScript Behavior

When you add `"composite": true` to `tsconfig.json`:

#### Changes to Compilation

| Aspect | Without Composite | With Composite |
|--------|------------------|----------------|
| **Command** | `tsc` works fine | **Must use** `tsc --build` |
| **Declaration files** | Optional | Always generated |
| **Cache file** | No `.tsbuildinfo` | Creates `.tsbuildinfo` |
| **Incremental compilation** | Basic | Advanced |

#### The `.tsbuildinfo` Cache

Composite projects create a build cache file:

```
core/
├── src/
├── dist/
├── tsconfig.json
└── tsconfig.tsbuildinfo  ← Build cache (not in dist/)
```

**What it contains:**
- Previous compilation configuration
- File timestamps and dependencies
- Build state information

**Why it matters:**
- Makes rebuilds much faster
- But can cause issues if not cleaned after config changes
- **Not removed** when you delete `dist/` folder

### Commands for Composite Projects

```bash
# Build (required for composite projects)
tsc --build

# Clean all outputs including cache
tsc --build --clean

# Force rebuild ignoring cache
tsc --build --force

# Watch mode
tsc --build --watch
```

### Common Pitfalls

#### Pitfall 1: Using `tsc` instead of `tsc --build`

```bash
# ❌ Wrong - may not generate declaration files
"build": "tsc && vite build"

# ✅ Correct - always works
"build": "tsc --build && vite build"
```

#### Pitfall 2: Only deleting `dist/` folder

```bash
# ❌ Incomplete - leaves cache behind
rm -rf dist/

# ✅ Complete - removes everything
tsc --build --clean
# or
pnpm clean
```

#### Pitfall 3: Stale cache after config changes

```bash
# After modifying tsconfig.json:

# ❌ May use old config
pnpm build

# ✅ Clean first
pnpm clean && pnpm build
# or
pnpm build:force
```

### Project Structure Example

```
PaleEngineWeb/
├── core/                          # Library package
│   ├── tsconfig.json             # composite: true
│   ├── tsconfig.tsbuildinfo      # Build cache
│   └── dist/
│       ├── index.mjs             # Vite output
│       └── index.d.ts            # TypeScript output
│
└── editor/                        # Application package
    ├── tsconfig.json             # references: [core]
    ├── tsconfig.tsbuildinfo      # Build cache
    └── dist/
        └── index.html            # Vite output
```

### Best Practices

1. **Always use `tsc --build`** in package.json scripts
2. **Clean cache after config changes** using `pnpm clean`
3. **Don't commit `.tsbuildinfo`** files (add to `.gitignore`)
4. **Use `pnpm clean`** instead of manually deleting folders

## Troubleshooting

### Common Issues and Solutions

#### 1. TypeScript Project References Errors

**Error**: `Referenced project must have setting "composite": true`

**Solution**: Add `"composite": true` to the referenced project's `tsconfig.json`

#### 2. Missing Type Declaration Files

**Error**: `Could not find a declaration file for module '@paleengine/core'`

**Cause**: `.d.ts` files not generated or in wrong location

**Solution**: 
- Ensure `"declaration": true` in `tsconfig.json`
- Check `"rootDir"` and `"outDir"` settings
- Verify `"emptyOutDir": false` in `vite.config.ts`

#### 3. Vite Clearing TypeScript Output

**Problem**: Vite deletes `.d.ts` files generated by tsc

**Solution**: Set `emptyOutDir: false` in `vite.config.ts`

#### 4. Node.js Version Compatibility

**Error**: `Vite requires Node.js version 20.19+ or 22.12+`

**Solution**: Update GitHub Actions to use Node.js 22:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'
```

#### 6. TypeScript Not Generating Declaration Files

**Problem**: TypeScript runs without errors but doesn't generate `.d.ts` files

**Symptoms**:
- `tsc` command completes successfully
- No `.d.ts` files in output directory
- Error: `Could not find a declaration file for module '@paleengine/core'`

**Root Cause**: `emitDeclarationOnly: true` can fail silently with composite projects

**Solution**:
1. Remove `emitDeclarationOnly: true` from `tsconfig.json`
2. Use `tsc --build --force` to force regeneration:
   ```bash
   # Linux/macOS
   rm -rf core/dist/*
   cd core && pnpm exec tsc --build --force
   
   # Windows PowerShell
   Remove-Item -Recurse -Force core\dist\*
   cd core; pnpm exec tsc --build --force
   ```

#### 7. allowImportingTsExtensions Configuration Error

**Error**: `Option 'allowImportingTsExtensions' can only be used when 'noEmit' is true`

**Cause**: This option conflicts with file generation

**Solution**: Remove `allowImportingTsExtensions: true` from `tsconfig.json`

### Build Verification

To verify the build process works correctly:

```bash
# Linux/macOS
# Clean build
pnpm clean  # Uses tsc --build --clean to remove dist/ and cache

# Build core
pnpm build:core
# Should generate: core/dist/index.mjs + core/dist/index.d.ts

# Build editor
pnpm build:editor
# Should generate: editor/dist/index.html + assets/

# Check for errors
echo "Build completed successfully!"
```

```powershell
# Windows PowerShell
# Clean build
pnpm clean  # Uses tsc --build --clean to remove dist/ and cache

# Build core
pnpm build:core
# Should generate: core/dist/index.mjs + core/dist/index.d.ts

# Build editor
pnpm build:editor
# Should generate: editor/dist/index.html + assets/

# Check for errors
Write-Host "Build completed successfully!"
```

**Important:** Always use `pnpm clean` instead of manually deleting folders. It removes both `dist/` directories and `.tsbuildinfo` cache files.

### Cross-Platform Commands Reference

| Task | Linux/macOS | Windows PowerShell | pnpm Script |
|------|-------------|--------------------|-------------|
| **Clean all build outputs** | `rm -rf core/dist editor/dist` | `Remove-Item -Recurse -Force core\dist\*, editor\dist\*` | `pnpm clean` ✅ |
| **Clean with cache** | `tsc --build --clean` | `tsc --build --clean` | `pnpm clean` ✅ |
| **List files** | `ls core/dist` | `Get-ChildItem core\dist` | - |
| **Find .d.ts files** | `find core/dist -name "*.d.ts"` | `Get-ChildItem -Recurse core\dist -Filter "*.d.ts"` | - |
| **Check TypeScript config** | `cd core && tsc --showConfig` | `cd core; tsc --showConfig` | - |
| **Force rebuild** | `cd core && tsc --build --force` | `cd core; tsc --build --force` | `pnpm build:force` ✅ |

**Recommended:** Use `pnpm` scripts instead of manual commands for better cross-platform compatibility.

### Available pnpm Scripts

#### Root Level Scripts

```bash
# Development
pnpm dev              # Start dev servers for all packages in parallel
pnpm dev:full         # Build core once, then start editor dev server

# Building
pnpm build            # Build all packages (core → editor)
pnpm build:clean      # Clean then build all packages
pnpm build:core       # Build only core package
pnpm build:editor     # Build only editor package

# Cleaning
pnpm clean            # Clean all packages (removes dist/ and .tsbuildinfo)

# Type Checking
pnpm type-check       # Run TypeScript type checking on all packages
```

#### Package-Level Scripts

```bash
# In core/ or editor/ directory
pnpm clean            # Clean this package (tsc --build --clean)
pnpm build            # Build this package (tsc --build && vite build)
pnpm build:force      # Force rebuild (clean + tsc --build --force + vite build)
pnpm dev              # Development mode
```

### Script Implementation

All scripts use `tsc --build` (not `tsc`) because of composite projects:

```json
// core/package.json
{
  "scripts": {
    "clean": "pnpm exec tsc --build --clean",
    "build": "tsc --build && vite build",
    "build:force": "npm run clean && tsc --build --force && vite build"
  }
}
```

### Development vs Production

| Environment | TypeScript | Vite | Purpose |
|-------------|------------|------|---------|
| **Development** | Type checking only | Dev server | Fast iteration |
| **Production** | Full compilation | Build | Deployment |

## Key Lessons Learned

During the development of this build system, we encountered several important issues:

### 1. `emitDeclarationOnly` Pitfall
- **Issue**: `emitDeclarationOnly: true` can fail silently with composite projects
- **Solution**: Remove this option and let TypeScript generate both `.js` and `.d.ts` files
- **Why**: Vite's `emptyOutDir: false` preserves the `.d.ts` files while overwriting `.js` files

### 2. Configuration Conflicts
- **Issue**: `allowImportingTsExtensions` conflicts with file generation
- **Solution**: Remove this option when generating files
- **Why**: This option is only compatible with `noEmit: true`

### 3. Force Rebuild Necessity
- **Issue**: TypeScript sometimes doesn't regenerate files when configuration changes
- **Solution**: Use `tsc --build --force` to force regeneration
- **Why**: Incremental compilation can cache outdated configurations

### 4. Cross-Platform Considerations
- **Issue**: Documentation often shows only Linux/macOS commands
- **Solution**: Provide both Linux and Windows PowerShell examples
- **Why**: Developers use different operating systems

## Summary

The PaleEngine build system uses a two-stage process:

1. **TypeScript** generates type declarations (`.d.ts`) for development
2. **Vite** generates optimized JavaScript (`.mjs`) for runtime

This separation allows for:
- ✅ Strict type checking during development
- ✅ Fast, optimized builds for production
- ✅ Proper library distribution with type information
- ✅ Automated deployment to GitHub Pages

The configuration ensures that both tools work together without conflicts, producing clean, optimized output ready for distribution and deployment.

**Final Working Configuration**:
- Core: `composite: true`, `declaration: true`, `emptyOutDir: false`
- Editor: `noEmit: true`, `references: [core]`
- Both: No `emitDeclarationOnly` or `allowImportingTsExtensions`
