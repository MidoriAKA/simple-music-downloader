import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { exec } from 'child_process';
import path from 'path';
import albumArt from 'album-art';
import fs from 'fs';
import NodeID3 from 'node-id3';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import toast from 'electron-simple-toast';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'src/preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  win.loadFile('./src/index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('download-video', async (event, { url, isPlaylist, outputPath }) => {
  const _isPlaylist = isPlaylist ? 'yes-playlist' : ''; 
  const downloadCommand = [
    ['yt-dlp'],
    ['--verbose'],
    [_isPlaylist],
    [`--output "${outputPath}/%(artist)s - %(title)s.%(ext)s"`],
    ['--windows-filenames'],
    ['--abort-on-unavailable-fragment'],
    ['--buffer-size 1M'],
    ['--extract-audio'],
    ['--audio-format mp3'],
    ['--audio-quality 320K'],
    ['--embed-metadata'],
    [`"${url}"`]
  ].join(' ');

  return new Promise((resolve, reject) => {
    exec(downloadCommand, (error, stdout, stderr) => {
      if (error) {
        toast.error("Oops!", "Download failed :(", 3000);
        reject(`Download failed: ${stderr}`);
      } else {
        toast.success("Success!", "Download completed :)", 3000);
        resolve(`Download completed: ${stdout}`);
      }
    });
  });
});

ipcMain.handle('add-cover-to-mp3-directory', async (event, directoryPath) => {
  console.log(directoryPath);
  const mp3Files = [];

  fs.readdirSync(directoryPath).forEach(file => {
    if (path.extname(file) === '.mp3') {
      mp3Files.push(path.join(directoryPath, file));
    }
  });

  mp3Files.forEach(async (filePath) => {
    await setCover(filePath);
  });
});

const setCover = async (directoryPath) => {
  try {
    NodeID3.read(directoryPath, async (error, tags) => {
      if (error) {
        toast.error("Oops!", "Error reading tags :(", 3000);
        return;
      }
  
      const albumName = tags.album ? tags.album : tags.title;
      const fileName = path.basename(directoryPath, '.mp3');
      console.log("fileName:", fileName);
      const [artist, title] = fileName.split(' - ');
      

      try {
        const coverUrl = await albumArt(artist, { album: albumName, size: 'large' });
        const coverData = await fetchImage(coverUrl);

        NodeID3.update({ image: coverData }, directoryPath, (tagError) => {
          if (tagError) {
            toast.error("Oops!", "Error updating tags :(", 3000);
          } else {
            console.log(`Cover art added to ${artist} - ${title}`);
          }
        });
      } catch (artError) {
        console.error(`Cover art not found for ${artist} - ${title}: ${artError}`);
      }
    });
  } catch (error) {
    console.error('Error in MP3 metadata processing:', error);
  }
};

async function fetchImage(url) {
  const res = await fetch(url);
  if (!res.ok){
    throw new Error(`Failed to fetch image: ${res.statusText}`)
  } else {
    console.log(`Image fetched successfully: ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer);
}

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) {
    return null;
  }

  const directoryPath = result.filePaths[0];
  const mp3Files = [];

  fs.readdirSync(directoryPath).forEach(file => {
    if (path.extname(file) === '.mp3') {
      mp3Files.push(path.join(directoryPath, file));
    }
  });

  const returnResult = [
    directoryPath,
    mp3Files
  ]

  return returnResult;
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
