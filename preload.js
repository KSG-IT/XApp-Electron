// The only bridge between the window and the main process. The window runs
// without Node.js (sandbox, context isolation) and can only call these.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("xapp", {
  obtainToken: (cardUuid) => ipcRenderer.invoke("api:obtain-token", cardUuid),
  getProducts: () => ipcRenderer.invoke("api:products"),
  getBalance: (cardUuid) => ipcRenderer.invoke("api:balance", cardUuid),
  charge: (payload) => ipcRenderer.invoke("api:charge", payload),
  terminateSession: () => ipcRenderer.invoke("api:terminate"),

  // The "Kryss" menu: Escape cancels and x confirms (main.js).
  setMenuItemEnabled: (id, enabled) =>
    ipcRenderer.send("menu:set-enabled", { id, enabled }),
  // Returns a function that removes the listener again.
  onMenuCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on("menu:command", listener);
    return () => ipcRenderer.removeListener("menu:command", listener);
  },
});
