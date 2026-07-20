# Building Standalone .exe Executable

This guide explains how to build your SASSC Credit Management System as a standalone Windows executable using Electron and Electron Builder.

## Prerequisites

- **Node.js**: Version 18+ installed
- **Windows**: For building .exe files (or use GitHub Actions for cross-platform builds)
- **Git**: For version control

## Setup

### 1. Install Dependencies

```bash
npm install
```

This installs both development and production dependencies including:
- **Electron**: Desktop app framework
- **Electron Builder**: Packager for creating installers
- **Concurrently**: For running dev and Electron simultaneously
- **Wait-on**: For waiting on dev server startup

### 2. Development Mode

To test the Electron app locally while developing:

```bash
npm run electron-dev
```

This will:
1. Start the Vite dev server on `http://localhost:3000`
2. Wait for the server to be ready
3. Launch the Electron app with hot-reload capabilities
4. Open DevTools for debugging

### 3. Build Standalone .exe

#### Option A: Quick Portable EXE (Recommended for Testing)

Builds a single standalone .exe that doesn't require installation:

```bash
npm run dist
```

Output file: `release/SASSC-Credit-Management-1.0.0.exe`

This .exe is fully portable - users can run it directly without installation.

#### Option B: NSIS Installer (For Distribution)

The build process automatically creates both:
1. **Installer** (`SASSC-Credit-Management-Setup-1.0.0.exe`) - Traditional Windows installer
2. **Portable** (`SASSC-Credit-Management-1.0.0.exe`) - Standalone executable

```bash
npm run electron-build
```

Both are created in the `release/` folder.

## Understanding the Build Process

### Architecture

```
SASS Credit Management System
├── React Frontend (Vite)
│   ├── Main UI Components
│   ├── Firebase Integration
│   └── Local State Management
├── Electron Main Process
│   ├── Window Management
│   ├── Menu & OS Integration
│   └── IPC Communication
└── Built Assets
    ├── HTML/CSS/JS (dist/)
    └── Preload Scripts (dist-electron/)
```

### Build Flow

1. **npm run build** - Compiles React app with Vite → `dist/`
2. **esbuild** - Compiles Electron main & preload → `dist-electron/`
3. **electron-builder** - Packages everything into .exe

### Files Included in .exe

- **dist/** - Your React app (UI, styles, assets)
- **electron/main.ts** - Electron process that launches the window
- **electron/preload.ts** - Secure bridge between React and Electron
- **node_modules** - All runtime dependencies
- **package.json** - App metadata & configuration

## Deployment Options

### Hybrid Mode (Recommended)

Your application supports **both** deployment modes:

**1. Standalone .exe (Desktop)**
- Users download and run `.exe` directly
- Full offline capability
- Firebase sync for online features
- Best for: Enterprise deployments, offline usage

**2. Web Version (SaaS)**
- Deploy web version to hosting (GitHub Pages, Vercel, AWS)
- Users access via browser
- Always latest version
- Best for: Multi-location teams, automatic updates

### Build Commands by Mode

```bash
# Desktop .exe
npm run dist                    # Creates SASSC-Credit-Management-1.0.0.exe

# Web Version
npm run build                   # Creates dist/ folder for hosting
npm run build -- --base=/app/   # For sub-path deployment
```

## Distribution

### For Desktop Users

1. Build the .exe: `npm run dist`
2. Locate in `release/` folder
3. Users can:
   - Download and run directly (portable version)
   - Run installer for Windows shortcuts (NSIS version)

### For Web Users

1. Build web version: `npm run build`
2. Deploy `dist/` folder to:
   - GitHub Pages
   - AWS S3 + CloudFront
   - Azure Static Web Apps
   - Vercel / Netlify
   - Your own web server

## Troubleshooting

### Build Issues

**Problem**: "electron not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

**Problem**: "dist folder not found"
```bash
npm run build  # Run this first
npm run dist
```

### Runtime Issues

**Blank window on startup**
- Check DevTools (Ctrl+Shift+I)
- Verify Firebase config is loaded
- Check browser console for errors

**Firebase not working in .exe**
- Ensure `firebase-applet-config.json` is in root
- CORS might block requests - check Firestore rules
- Use `window.electronAPI` to access app data if needed

## Advanced Configuration

### Customizing Installer

Edit `package.json` build section:

```json
"build": {
  "appId": "com.sassc.fmcg",
  "productName": "SASSC Credit Management",
  "nsis": {
    "installerIcon": "assets/icon.ico",
    "uninstallerIcon": "assets/icon.ico",
    "installerHeaderIcon": "assets/icon.ico"
  }
}
```

### Code Signing (Optional)

For production releases, add code signing:

```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "password",
  "signingHashAlgorithms": ["sha256"],
  "sign": "./customSign.js"
}
```

## Continuous Deployment

See `.github/workflows/` for automated build pipelines:
- Automatically builds .exe on every release
- Creates GitHub release with downloadable executable
- Can auto-update installed apps

## Performance Tips

1. **File Size**: Current build ~150-200MB (Electron + Node modules)
   - Consider `electron-builder` `nsis.artifactName` for naming
   - Compress with NSIS installer

2. **Startup Time**: ~2-3 seconds
   - Preload scripts for faster initialization
   - Lazy load Firebase only when needed

3. **Offline Mode**:
   - App works fully offline with localStorage
   - Firebase sync when connection restored

## Next Steps

1. ✅ Build: `npm run dist`
2. Test the .exe thoroughly
3. Create GitHub release with .exe
4. Distribute to users
5. Monitor for crashes/errors via Firebase logs

## Support

- Electron Docs: https://www.electronjs.org/docs
- Electron Builder: https://www.electron.build/
- Vite Docs: https://vitejs.dev/
