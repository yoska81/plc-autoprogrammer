# ISA Auto Programmer on Windows

ISA Auto Programmer is a normal Windows program. You install it once. It then opens in its own window from the Start menu or the desktop icon.

## Install

1. Open the project's **Releases** page on GitHub: `https://github.com/yoska81/plc-autoprogrammer/releases`.
2. Under the newest release, download **`ISA-Auto-Programmer-Setup-<version>.exe`**.
3. Double-click the downloaded file.
4. Windows may show a blue box, **"Windows protected your PC"**. This happens because the installer is not yet signed with a company certificate. Click **More info**, then **Run anyway**.
5. Follow the installer: **Next → Install → Finish**. You can keep the suggested folder. No administrator password is needed: the program installs for your Windows user only.
6. The program starts. Next time, open it from the **Start menu** or the **ISA Auto Programmer** icon on the desktop.

## First start: connect the AI

The program designs equipment, wiring, screens and the PLC program with Claude (Anthropic's AI). For that it needs an **API key**. The key is not the same as a Claude.ai login.

1. Create a key at **console.anthropic.com → API keys**. Copy it (it starts with `sk-ant-`).
2. In the program, open **Options → Settings** (or the gear icon).
3. Paste the key under **Anthropic (Claude) → API Key**.
4. Click **Test connection**. A green "Connected" message means it works. A red message says, in plain words, what to fix: wrong key, no credit on the account, model not available, or the internet being blocked.
5. Click **Save Settings**.

Everything except the AI works offline: the drawings, simulation, labels and documents need no internet.

## Where your work is saved

- **Projects are saved automatically** on this PC. There is no Save button for projects. Close the program at any time; everything is there next time.
- They are stored in your Windows user profile, in the folder `%APPDATA%\ISA Auto Programmer` (paste that into the Explorer address bar to open it). Uninstalling the program does **not** delete them.
- **Files you export** (PDF drawings, Excel report, BOM, DXF for the machine shop, the 3D STEP model, the ZIP of everything) open a normal **Save As** window, so you choose the folder. It starts in **Documents**.
- To move projects to another PC, copy the whole `%APPDATA%\ISA Auto Programmer` folder while the program is closed.

## Printing labels and documents

- **Print** opens the normal Windows print window. Choose your printer, e.g. the Brady label printer.
- Labels print at their **real size** (100 %, never "fit to page"). In the label printer's settings, choose the label stock that is loaded in the printer.
- In the Labels tab you can pick a Windows printer directly; the program then shows the printers Windows knows about.

## Update to a new version

1. Download the newer `ISA-Auto-Programmer-Setup-<version>.exe` from the Releases page.
2. Close ISA Auto Programmer.
3. Run the new installer. It replaces the program and keeps your projects and settings.

The version number is shown at the bottom right of the window and under **Help → About**.

## Uninstall

Windows **Settings → Apps → Installed apps → ISA Auto Programmer → Uninstall**. Your projects stay in `%APPDATA%\ISA Auto Programmer`. Delete that folder too if you want them gone.

## If something goes wrong

- **The window is blank or looks wrong:** use **View → Reload**.
- **The AI does not answer:** use **Settings → Test connection** and follow its message. A company firewall or VPN may block `api.anthropic.com`.
- **Text too small or too big:** **View → Zoom in / Zoom out / Actual size**.

---

## For developers

| Command | What it does |
|---|---|
| `npm run dev` | Web version in the browser (unchanged). |
| `npm run desktop` | Builds the app into `dist-desktop/` and opens it in Electron. |
| `npm run dist:win` | Builds the Windows installer into `release/` (on Linux this needs `wine64` + `wine32`). |
| `xvfb-run -a node e2e/desktop.e2e.cjs` | Desktop test, after `npm run build:desktop`: window and bridge, projects kept after a restart, Save dialog, printing at real size. |

- **Structure:**
  - `electron/main.cjs` serves the built app from the private scheme `app://isa`. That gives the app a fixed origin, so localStorage keeps the projects, and Anthropic calls work exactly as in the browser.
  - The main process also opens other links in the browser, remembers the window size, allows only one running copy, and handles Save and Print.
  - `electron/preload.cjs` exposes `window.isaDesktop` to the page: `print`, `listPrinters`, `saveFile`, `version`. The shared TypeScript types are in `src/desktop/bridge.ts`.
  - The page has no Node access: context isolation and the sandbox are on.
- **Printing:** Electron's PDF viewer prints blank pages from a hidden window. Instead, `electron/print/print.html` draws each PDF page with pdf.js:
  - labels at 600 dpi, sheets at 200 dpi;
  - each image is sized to the page's real size in mm, on CSS pages of that size (mixed sizes allowed);
  - it is printed with `webContents.print` at scale 100, no margins, and the label size as the paper size for label PDFs.
- **Installer:** electron-builder, NSIS, x64, per user. Icon in `build/icon.png`. Version from `package.json`.
- **CI:** `.github/workflows/windows-installer.yml` builds on `windows-latest` for every push to the integration branch (the installer is attached to the run) and for tags `v*` (also published as a GitHub Release).
- **Later:** code signing. With a code-signing certificate, the SmartScreen warning goes away. Set `CSC_LINK` / `CSC_KEY_PASSWORD` in the workflow. Automatic updates (electron-updater, `latest.yml` is already produced) can come after signing.
