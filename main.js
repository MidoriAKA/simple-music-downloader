
import { app, BrowserWindow, ipcMain, dialog, clipboard } from "electron";
import { exec, spawn } from "child_process";
import path from "path";
import albumArt from "album-art";
import fs from "fs";
import NodeID3 from "node-id3";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";
import toast from "electron-simple-toast";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "src/preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  win.loadFile("./src/index.html");
}

app.whenReady().then(createWindow);


ipcMain.handle("paste-from-clipboard", async () => {
  return clipboard.readText();
});

ipcMain.handle("download-video", async (event, { url, outputPath }) => {
  const ytDlpPath = path.join(__dirname, "bin", "yt-dlp.exe");
  const isPlaylist = url.includes("playlist") ? "yes-playlist" : ""; 
  const downloadCommand = [
    [`"${ytDlpPath}"`],
    ["--verbose"],
    [_isPlaylist],
    [`--output "${outputPath}/%(artist)s - %(title)s.%(ext)s"`],
    ["--windows-filenames"],
    ["--abort-on-unavailable-fragment"],
    ["--buffer-size 1M"],
    ["--extract-audio"],
    ["--audio-format mp3"],
    ["--audio-quality 320K"],
    ["--embed-metadata"],
    [`"${url}"`]
  ].join(" ");

  return new Promise((resolve, reject) => {
    const process = spawn(downloadCommand, {
      shell: true,
      cwd: `${__dirname}`
    });
    process.stdout.on('data', (data) => {
      event.sender.send('receive-log', data.toString());
      console.log("\x1b[36m%s\x1b[0m", `stdout: ${data}`);
    });
    process.stderr.on('data', (data) => {
      event.sender.send('receive-log', data.toString());
      console.error(`stderr: ${data}`);
    });
    process.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      if (code === 0) {
        toast.success("Success!", "Download completed successfully :)", 3000);
        resolve("Download completed successfully :)");
      } else {
        reject("Download failed :(");
      }
    });
  });
});

ipcMain.handle("add-cover-to-mp3-directory", async (event, directoryPath) => {
  console.log(directoryPath);
  const mp3Files = [];

  fs.readdirSync(directoryPath).forEach(file => {
    if (path.extname(file) === ".mp3") {
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
      const fileName = path.basename(directoryPath, ".mp3");
      console.log("fileName:", fileName);
      const [artist, title] = fileName.split(" - ");
      

      try {
        const coverUrl = await albumArt(artist, { album: albumName, size: "large" });
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
    console.error("Error in MP3 metadata processing:", error);
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

ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  if (result.canceled) {
    return null;
  }

  const directoryPath = result.filePaths[0];
  const mp3Files = [];

  fs.readdirSync(directoryPath).forEach(file => {
    if (path.extname(file) === ".mp3") {
      mp3Files.push(path.join(directoryPath, file));
    }
  });

  const returnResult = [
    directoryPath,
    mp3Files
  ]

  return returnResult;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
