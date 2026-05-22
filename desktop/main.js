/**
 * AEGIS Desktop — Electron main process.
 *
 * This shell hosts the AEGIS web app inside a native window. By default it
 * loads the production deployment; flipping AEGIS_URL lets you target a
 * local dev server during development.
 */
const { app, BrowserWindow, Menu, shell, nativeImage } = require("electron");
const path = require("node:path");

const TARGET_URL = process.env.AEGIS_URL || "https://aegis-v1-0.onrender.com";

// Single instance — clicking the icon again focuses the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let mainWindow = null;
let splashWindow = null;

function createSplash() {
  const win = new BrowserWindow({
    width: 460,
    height: 280,
    frame: false,
    resizable: false,
    movable: false,
    show: false,
    backgroundColor: "#05070a",
    transparent: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, "splash.html"));
  win.once("ready-to-show", () => win.show());
  return win;
}

function createMainWindow() {
  const iconPath =
    process.platform === "linux"
      ? path.join(__dirname, "icons", "icon.png")
      : process.platform === "win32"
        ? path.join(__dirname, "icons", "icon.ico")
        : undefined;

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: "#05070a",
    icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
      // The shell hosts a remote URL — no Node integration in the renderer.
      nodeIntegration: false,
    },
  });

  // Open external links (mailto:, https://t.me/..., etc) in the user's browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "deny" };
  });

  win.webContents.on("did-finish-load", () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    win.show();
  });

  // Show a friendly message if the network/Render is unreachable.
  win.webContents.on(
    "did-fail-load",
    (_e, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) return; // user-initiated abort
      const html = `
        <html><body style="background:#05070a;color:#10F5A8;font-family:monospace;
          display:grid;place-items:center;height:100vh;text-align:center;padding:24px">
          <div>
            <div style="font-size:18px;letter-spacing:6px;margin-bottom:12px">AEGIS</div>
            <div style="opacity:0.7;font-size:13px;margin-bottom:6px">CONNECTION FAILED</div>
            <div style="opacity:0.5;font-size:11px;max-width:340px;line-height:1.6">
              ${errorDescription || "Could not reach the AEGIS server."}<br/>
              ${validatedURL || ""}
            </div>
            <button onclick="location.href='${TARGET_URL}'"
              style="margin-top:18px;background:rgba(16,245,168,0.1);
                color:#10F5A8;border:1px solid rgba(16,245,168,0.4);
                padding:8px 18px;font-family:monospace;cursor:pointer;border-radius:6px">
              RETRY
            </button>
          </div>
        </body></html>`;
      win.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
      );
    },
  );

  win.loadURL(TARGET_URL);
  return win;
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Open AEGIS Site",
          click: () => shell.openExternal(TARGET_URL),
        },
        {
          label: "Source on GitHub",
          click: () =>
            shell.openExternal("https://github.com/YoungMea/AEGIS_v1.0"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  splashWindow = createSplash();
  mainWindow = createMainWindow();

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
