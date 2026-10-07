const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
const path = require('path')
const api = require('./apiClient')
const updater = require('./updater')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 1100,
    minWidth: 1100,
    height: 800,
    minHeight: 800,
    backgroundColor: '#1d1e1f',
    center: true,
    icon: path.join(__dirname, 'assets/icons/png/64x64.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // The window is one page (dist/index.html) and never navigates.
  win.webContents.on('will-navigate', event => event.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  win.maximize()

  // and load the index.html of the app.
  win.loadFile(path.join(__dirname, 'dist', 'index.html'))

  // Open the DevTools.
  // win.webContents.openDevTools();

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  registerIpcHandlers()

  const menu = buildMenuFromTemplate()
  Menu.setApplicationMenu(menu)

  createWindow()
})

function registerIpcHandlers() {
  ipcMain.handle('api:obtain-token', (_event, cardUuid) =>
    api.obtainToken(String(cardUuid))
  )
  ipcMain.handle('api:products', () => api.getProducts())
  ipcMain.handle('api:balance', (_event, cardUuid) =>
    api.getBalance(String(cardUuid))
  )
  ipcMain.handle('api:charge', (_event, payload) => api.charge(payload))
  ipcMain.handle('api:terminate', () => api.terminateSession())

  // Read once by preload.js, before the window renders its first screen.
  ipcMain.on('update:config', event => {
    event.returnValue = {
      enabled: updater.enabled,
      intervalMs: updater.intervalMs,
    }
  })
  ipcMain.handle('update:check', () => updater.check())
  ipcMain.handle('update:install', () => updater.install())
  ipcMain.handle('update:restart', () => updater.restart())

  ipcMain.on('menu:set-enabled', (_event, { id, enabled }) => {
    if (id !== 'kryss' && id !== 'cancel') return
    Menu.getApplicationMenu().getMenuItemById(id).enabled = Boolean(enabled)
  })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function buildMenuFromTemplate() {
  const menuTemplate = [
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Kryss',
      submenu: [
        {
          id: 'cancel',
          label: 'Cancel kryss',
          accelerator: 'Escape',
          enabled: false,
          click: () => {
            win.webContents.send('menu:command', 'cancel')
          },
        },
        { type: 'separator' },
        {
          id: 'kryss',
          label: 'Confirm kryss',
          accelerator: 'x',
          enabled: false,
          click: () => {
            win.webContents.send('menu:command', 'kryss')
          },
        },
      ],
    },
    {
      role: 'window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
    {
      role: 'help',
      submenu: [
        {
          label: "Don't click me",
          click: () => {
            retrofitTurboAccelerators()
          },
        },
      ],
    },
  ]

  if (process.platform === 'darwin') {
    menuTemplate.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })

    // Window menu
    menuTemplate[3].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' },
    ]
  }

  return Menu.buildFromTemplate(menuTemplate)
}

function retrofitTurboAccelerators() {
  return dialog['\x73\x68\x6f\x77\x4d\x65\x73\x73\x61\x67\x65\x42\x6f\x78']({
    type: '\x69\x6e\x66\x6f',
    detail: '\x48\x41\x44\x4f\x55\x4b\x45\x4e\x21',
    message: '\ud83c\uddea\ud83c\uddfa\ud83e\uddff',
    icon: path['\x6a\x6f\x69\x6e'](
      __dirname,
      '\x61\x73\x73\x65\x74\x73\x2f\x69\x6d\x61\x67\x65\x73\x2f\x68\x61\x64\x6f\x75\x6b\x65\x6e\x2e\x70\x6e\x67'
    ),
  })
}
