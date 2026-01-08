const express = require('express');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const open = require('open');
const os = require('os');
const https = require('https');
const NodeID3 = require('node-id3');
const ffmpegStatic = require('ffmpeg-static');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'src')));
app.use(express.json());

// -------------------------------------------------------------
// Path Configuration
// -------------------------------------------------------------
const isPkg = typeof process.pkg !== 'undefined';
const exeDir = isPkg ? path.dirname(process.execPath) : __dirname;

// Base path for Midori data in Documents
const midoriPath = path.join(os.homedir(), 'Documents', 'midori');
const binDir = path.join(midoriPath, 'bin');
const logsDir = path.join(midoriPath, 'logs');

// Binaries
const ytDlpPath = path.join(binDir, 'yt-dlp.exe');
const ffmpegExePath = path.join(binDir, 'ffmpeg.exe');

// Ensure system directories exist
if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Helper to get actual download path based on type
function getRootDownloadPath(pathType) {
  switch (pathType) {
    case 'downloads':
      return path.join(os.homedir(), 'Downloads');
    case 'exe':
      return path.join(exeDir, 'downloads');
    case 'midori':
    default:
      const p = path.join(midoriPath, 'downloads');
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      return p;
  }
}
const defaultDownloadsPath = getRootDownloadPath('midori');

// -------------------------------------------------------------
// Logging Setup
// -------------------------------------------------------------
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-');
};
const logFileName = `session_${getTimestamp()}.log`;
const logFilePath = path.join(logsDir, logFileName);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function logToFile(msg) {
  const time = new Date().toLocaleTimeString();
  logStream.write(`[${time}] ${msg}\n`);
}

// Hook stdout/stderr
const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);

process.stdout.write = (chunk, encoding, callback) => {
  logToFile(chunk.toString().trim());
  return originalStdout(chunk, encoding, callback);
};

process.stderr.write = (chunk, encoding, callback) => {
  logToFile(chunk.toString().trim());
  return originalStderr(chunk, encoding, callback);
};

console.log("      __");
console.log("     /\\ \\");
console.log("    /  \\ \\");
console.log("   / /\\ \\ \\");
console.log("  / / /\\ \\ \\");
console.log(" / / /__\\_\\ \\");
console.log("/ / /________\\");
console.log("\\/___________/");
console.log("-----------------------------------------");
console.log("Welcome to Simple Music Downloader - MUDO 🤫");
console.log(`Session Started: ${new Date().toLocaleString()}`);
console.log(`Exe Dir: ${exeDir}`);
console.log(`Data Dir: ${midoriPath}`);
console.log(`Default Downloads: ${defaultDownloadsPath}`);
console.log("-----------------------------------------");
console.log("\n");
console.log("Press Ctrl+C or just close this window to exit.");
console.log("\n");
console.log("-----------------------------------------");

// -------------------------------------------------------------
// FFmpeg Deployment Logic
// -------------------------------------------------------------
function setupFFmpeg() {
  if (!fs.existsSync(ffmpegExePath)) {
    console.log("Setting up FFmpeg for the first time...");
    try {
      if (ffmpegStatic) {
        fs.copyFileSync(ffmpegStatic, ffmpegExePath);
        console.log(`FFmpeg copied to: ${ffmpegExePath}`);
      } else {
        console.error("FFmpeg static path not found.");
      }
    } catch (e) {
      console.error(`Failed to copy FFmpeg: ${e.message}`);
    }
  } else {
    console.log(`FFmpeg found at: ${ffmpegExePath}`);
  }
}
setupFFmpeg();

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Status Check
app.get('/api/yt-dlp/status', (req, res) => {
  if (fs.existsSync(ytDlpPath)) {
    exec(`"${ytDlpPath}" --version`, (err, stdout) => {
      if (err) return res.json({ installed: true, version: "Unknown (Error)" });
      res.json({ installed: true, version: stdout.trim() });
    });
  } else {
    res.json({ installed: false });
  }
});

// Helper: Download with redirect support using https
function downloadFilePromise(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const handleRequest = (requestUrl) => {
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': '*/*'
        }
      };

      https.get(requestUrl, options, (response) => {
        // Handle Redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
          if (response.headers.location) {
            return handleRequest(response.headers.location);
          }
          return reject(new Error("Redirect location missing"));
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`Server returned status code ${response.statusCode}`));
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          fs.unlink(dest, () => { });
          reject(err);
        });

      }).on('error', (err) => {
        fs.unlink(dest, () => { });
        reject(err);
      });
    };

    handleRequest(url);
  });
}

// yt-dlp Update / Install
app.post('/api/yt-dlp/update', async (req, res) => {
  const url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
  try {
    await downloadFilePromise(url, ytDlpPath);
    res.json({ success: true, message: "yt-dlp downloaded successfully." });
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper for image fetching
async function fetchImage(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Get Directories API
app.get('/api/directories', (req, res) => {
  const pathType = req.query.pathType || 'midori';
  const rootPath = getRootDownloadPath(pathType);
  try {
    if (!fs.existsSync(rootPath)) {
      fs.mkdirSync(rootPath, { recursive: true });
    }

    const items = fs.readdirSync(rootPath, { withFileTypes: true });
    const dirs = items
      .filter(item => item.isDirectory())
      .map(item => item.name);

    res.json({ success: true, directories: dirs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper: Search iTunes for Cover Art
async function searchItunesCover(term) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const artUrl = data.results[0].artworkUrl100;
      return artUrl ? artUrl.replace('100x100bb', '600x600bb') : null;
    }
  } catch (e) {
    console.error("iTunes Search Error:", e.message);
  }
  return null;
}

// Add Cover Art API
app.post('/api/add-cover', async (req, res) => {
  const subFolder = req.body.subFolder || "";
  const pathType = req.body.pathType || "midori";
  let targetPath = getRootDownloadPath(pathType);

  if (subFolder) {
    const safeSub = subFolder.replace(/[<>:"/\\|?*]/g, "_");
    targetPath = path.join(targetPath, safeSub);
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(400).json({ message: `Directory not found: ${targetPath}` });
  }

  const logs = [];
  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  log(`Starting add-cover (iTunes) for: ${path.basename(targetPath)}`);

  try {
    const files = fs.readdirSync(targetPath).filter(file => path.extname(file).toLowerCase() === ".mp3");

    if (files.length === 0) {
      return res.json({ message: 'No MP3 files found.', logs });
    }

    for (const file of files) {
      const filePath = path.join(targetPath, file);

      await new Promise((resolve) => {
        NodeID3.read(filePath, async (error, tags) => {
          let artist = "";
          let title = "";

          // 1. Try tags
          if (!error && tags) {
            artist = tags.artist || tags.performerInfo || tags.composer;
            title = tags.title;
          }

          // 2. Fallback: Filename Parsing
          if (!artist) {
            const fileName = path.basename(file, ".mp3");
            const parts = fileName.split(" - ");
            if (parts.length >= 2) {
              artist = parts[0].trim();
              title = parts[1].trim();
            } else {
              title = fileName;
            }
          }

          if (!artist && !title) {
            log(`[Skip] Cannot determine query: ${file}`);
            resolve();
            return;
          }

          try {
            // Search Query: Artist + Title
            const query = (artist ? artist + " " : "") + (title || "");
            const coverUrl = await searchItunesCover(query);

            if (coverUrl) {
              const coverData = await fetchImage(coverUrl);
              const success = NodeID3.update({ image: coverData }, filePath);
              if (success) log(`[OK] Cover added: ${file} (found: ${query})`);
              else log(`[Fail] write tag: ${file}`);
            } else {
              log(`[404] No art found for: ${query}`);
            }
          } catch (artError) {
            log(`[Err] Fetch art: ${file} (${artError.message})`);
          }
          resolve();
        });
      });
    }
    res.json({ message: 'Batch cover art process completed.', logs });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});


// Open Folder API
app.post('/api/open-folder', async (req, res) => {
  const subFolder = req.body.subFolder || "";
  const pathType = req.body.pathType || "midori";
  let targetPath = getRootDownloadPath(pathType);
  if (subFolder) targetPath = path.join(targetPath, subFolder);

  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  try {
    await open(targetPath);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});


// Download API (Streaming)
app.get('/api/download', async (req, res) => {
  const { url, subFolder, format, bitrate, pathType } = req.query;

  if (!url) return res.status(400).send("URL required");

  // Determine Output Path
  let outputTemplate = '%(title)s.%(ext)s';
  const rootPath = getRootDownloadPath(pathType || 'midori');
  let cwd = rootPath;

  if (subFolder) {
    const safeDir = subFolder.replace(/[<>:"/\\|?*]/g, "_");
    cwd = path.join(rootPath, safeDir);
    if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });
    // Use "Artist - Title" (fallback to uploader if artist missing) to avoid syntax errors
    outputTemplate = '%(artist,uploader)s - %(title)s.%(ext)s';
  } else {
    // Same logic for playlist/root
    outputTemplate = '%(playlist_title|.)s/%(artist,uploader)s - %(title)s.%(ext)s';
  }

  // Construct Arguments
  const args = [
    url,
    '-o', outputTemplate,
    '--newline',
    '--progress',
    '--no-mtime',
    '--add-metadata', // <--- IMPORTANT: Add metadata to file
    '--ffmpeg-location', binDir
  ];

  if (format === 'wav') {
    args.push('-x', '--audio-format', 'wav');
  } else {
    args.push('-x', '--audio-format', 'mp3');
    if (bitrate) {
      args.push('--audio-quality', bitrate);
    } else {
      args.push('--audio-quality', '320K');
    }
  }

  console.log(`Starting Download: ${url} -> ${cwd}`);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const child = spawn(ytDlpPath, args, { cwd });

  child.stdout.on('data', (data) => {
    res.write(data);
    console.log(data.toString().trim());
  });

  child.stderr.on('data', (data) => {
    res.write(data);
    console.log(data.toString().trim());
  });

  child.on('close', (code) => {
    console.log(`yt-dlp exited with code ${code}`);
    res.end();

    // Force Cleanup WebM files
    setTimeout(() => {
      try {
        if (fs.existsSync(cwd)) {
          const files = fs.readdirSync(cwd);
          files.forEach(file => {
            if (path.extname(file).toLowerCase() === '.webm') {
              const filePath = path.join(cwd, file);
              try {
                fs.unlinkSync(filePath);
                console.log(`[Cleanup] Deleted leftover: ${file}`);
              } catch (e) {
                console.error(`[Cleanup] Failed to delete ${file}: ${e.message}`);
              }
            }
          });
        }
      } catch (err) {
        console.error(`[Cleanup] Error scanning directory: ${err.message}`);
      }
    }, 2000); // Wait 2s for file locks to release
  });

  req.on('close', () => {
    if (!child.killed) child.kill();
  });
});

// -------------------------------------------------------------
// Global Error Handlers (Prevent Exit)
// -------------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  logToFile(`CRITICAL: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  logToFile(`CRITICAL REJECTION: ${reason}`);
});


// Start Server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);

  if (isPkg) {
    open(`http://localhost:${port}`);
  }
});

// Keep console open on exit
if (process.platform === "win32") {
  var rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
}
