const {app, BrowserWindow, Menu, dialog} = require('electron');
let path = require('path');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 1150,
        minWidth: 1150,
        height: 750,
        minHeight: 750,
        backgroundColor: '#1d1e1f',
        icon: path.join(__dirname, 'assets/icons/png/64x64.png'),
        webPreferences: {
            nodeIntegration: true,
        }
    });

    // and load the index.html of the app.
    win.loadFile('x_view/productView.html');
    // win.loadFile('index.html');

    // Open the DevTools.
    // win.webContents.openDevTools();

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    });

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createWindow();

    const menu = buildMenuFromTemplate();
    Menu.setApplicationMenu(menu);
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function buildMenuFromTemplate() {
    const menuTemplate = [
        {
            label: 'View',
            submenu: [
                {role: 'reload'},
                {role: 'forcereload'},
                {role: 'toggledevtools'},
                {type: 'separator'},
                {role: 'togglefullscreen'}
            ]
        },
        {
            label: 'Kryss',
            submenu: [
                {
                    id: 'scan',
                    label: 'Mock card scan',
                    accelerator: 'CommandOrControl+S',
                    click: () => {
                        win.webContents.send('login');
                    }
                },
                {type: 'separator'},
                {
                    id: 'cancel',
                    label: 'Cancel kryss',
                    accelerator: 'Escape',
                    enabled: false,
                    click: () => {
                        win.webContents.send('cancel');
                    }
                },
                {type: 'separator'},
                {
                    id: 'kryss',
                    label: 'Confirm kryss',
                    accelerator: 'Enter',
                    enabled: false,
                    click: () => {
                        win.webContents.send('kryss');
                    }
                },
            ]
        },
        {
            role: 'window',
            submenu: [
                {role: 'minimize'},
                {role: 'close'}
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Don\'t click me',
                    click: () => {
                        retrofitTurboAccelerators();
                    }
                }
            ]
        }
    ];

    if (process.platform === 'darwin') {
        menuTemplate.unshift({
            label: app.getName(),
            submenu: [
                {role: 'about'},
                {type: 'separator'},
                {role: 'hide'},
                {role: 'hideothers'},
                {role: 'unhide'},
                {type: 'separator'},
                {role: 'quit'}
            ]
        });

        // Window menu
        menuTemplate[3].submenu = [
            {role: 'close'},
            {role: 'minimize'},
            {role: 'zoom'},
            {type: 'separator'},
            {role: 'front'}
        ]
    }

    return Menu.buildFromTemplate(menuTemplate);
}

function retrofitTurboAccelerators() {
    return dialog['\x73\x68\x6f\x77\x4d\x65\x73\x73\x61\x67\x65\x42\x6f\x78']({
        '\x74\x79\x70\x65': '\x69\x6e\x66\x6f',
        '\x64\x65\x74\x61\x69\x6c': '\x48\x41\x44\x4f\x55\x4b\x45\x4e\x21',
        '\x6d\x65\x73\x73\x61\x67\x65': '\ud83c\uddea\ud83c\uddfa\ud83e\uddff',
        '\x69\x63\x6f\x6e': path['\x6a\x6f\x69\x6e'](__dirname,
            '\x61\x73\x73\x65\x74\x73\x2f\x69\x6d\x61\x67\x65\x73\x2f\x68\x61\x64\x6f\x75\x6b\x65\x6e\x2e\x70\x6e\x67')
    });
}
