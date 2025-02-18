const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startServer, app: serverApp } = require('./server');
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  startServer(mainWindow);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
}); 