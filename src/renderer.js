// -------------------------------------------------------------
// i18n Logic
// -------------------------------------------------------------
let currentLang = localStorage.getItem('language') || 'en';

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('language', lang);
  document.documentElement.lang = lang;

  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });

  const placeHolders = document.querySelectorAll('[data-i18n-placeholder]');
  placeHolders.forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[lang] && translations[lang][key]) {
      el.placeholder = translations[lang][key];
    }
  });

  // Update language select if it exists
  const langSelect = document.getElementById('language-select');
  if (langSelect) langSelect.value = lang;
}

// Initial set
setLanguage(currentLang);

// -------------------------------------------------------------
// Tutorial Logic
// -------------------------------------------------------------
const tutorialModal = document.getElementById('tutorial-modal');
const tutorialNextBtn = document.getElementById('tutorial-next-btn');
const tutorialStep1 = document.getElementById('tutorial-step-1');
const tutorialStep2 = document.getElementById('tutorial-step-2');
const tutorialInstallBtn = document.getElementById('tutorial-install-btn');

let tutorialStep = 1;

function showTutorial() {
  const completed = localStorage.getItem('tutorialCompleted');
  if (completed) return;
  tutorialModal.style.display = 'flex';
}

tutorialNextBtn.addEventListener('click', () => {
  if (tutorialStep === 1) {
    tutorialStep1.style.display = 'none';
    tutorialStep2.style.display = 'block';
    tutorialNextBtn.textContent = translations[currentLang].tutorialFinish;
    tutorialStep = 2;
  } else {
    tutorialModal.style.display = 'none';
    localStorage.setItem('tutorialCompleted', 'true');
  }
});

tutorialInstallBtn.addEventListener('click', async () => {
  tutorialInstallBtn.disabled = true;
  await updateYtDlp();
  tutorialInstallBtn.disabled = false;
});

// -------------------------------------------------------------
// Language Selection
// -------------------------------------------------------------
document.getElementById('language-select').addEventListener('change', (e) => {
  setLanguage(e.target.value);
});

// -------------------------------------------------------------
// Global State & Utils
// -------------------------------------------------------------
let downloadHistory = []; // Array of { title, time, status }

function addLog(text) {
  const logs = document.getElementById("logs");
  const foreground = document.getElementById("foreground");

  if (!text.trim()) return;

  const div = document.createElement("div");
  div.className = "log-entry";
  div.textContent = text.trim();
  logs.appendChild(div);

  while (logs.children.length > 50) { // Limit logs to 50 lines
    logs.removeChild(logs.firstChild);
  }
  foreground.scrollTop = foreground.scrollHeight;
}

function clearLogs() {
  document.getElementById("logs").innerText = "";
}

// -------------------------------------------------------------
// Tab Logic
// -------------------------------------------------------------
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Active Styles
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show Content
    const targetId = btn.getAttribute('data-tab');
    tabContents.forEach(c => {
      c.classList.remove('active');
      if (c.id === targetId) c.classList.add('active');
    });

    // Trigger actions
    if (targetId === 'tab-library') refreshLibrary();
    if (targetId === 'tab-history') renderHistory();
  });
});

// -------------------------------------------------------------
// Library Logic
// -------------------------------------------------------------
const libraryList = document.getElementById('library-list');
const refreshLibBtn = document.getElementById('refresh-lib-btn');

refreshLibBtn.addEventListener('click', refreshLibrary);

async function refreshLibrary() {
  const pathType = document.getElementById('path-type-select').value;
  libraryList.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">Loading...</div>';

  try {
    const res = await fetch(`/api/directories?pathType=${pathType}`);
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    const dirs = data.directories;
    libraryList.innerHTML = '';

    if (dirs.length === 0) {
      libraryList.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">No folders found in downloads.</div>';
      return;
    }

    // Add Root Folder Option
    createLibraryItem("(Root Downloads Folder)", "");

    // Add Subfolders
    dirs.forEach(dir => createLibraryItem(dir, dir));

  } catch (e) {
    libraryList.innerHTML = `<div style="text-align:center; color:var(--accent-color);">Error: ${e.message}</div>`;
  }
}

function createLibraryItem(label, subFolderVal) {
  const item = document.createElement('div');
  item.className = 'list-item';

  item.innerHTML = `
        <div class="list-info">
            <div class="list-title">${label}</div>
            <div class="list-sub">${subFolderVal ? './downloads/' + subFolderVal : './downloads'}</div>
        </div>
        <div class="list-actions">
            <button class="btn btn-secondary btn-sm action-add-cover" data-folder="${subFolderVal}">Add Cover</button>
            <button class="btn btn-secondary btn-sm action-open" data-folder="${subFolderVal}">Open</button>
        </div>
    `;

  // Bind Events
  const pathType = document.getElementById('path-type-select').value;
  const openBtn = item.querySelector('.action-open');
  openBtn.addEventListener('click', () => openFolder(subFolderVal, pathType));

  const coverBtn = item.querySelector('.action-add-cover');
  coverBtn.addEventListener('click', () => addCoverToFolder(subFolderVal, pathType));

  libraryList.appendChild(item);
}

async function openFolder(subFolder, pathType) {
  try {
    await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subFolder, pathType })
    });
  } catch (e) { alert(e.message); }
}

async function addCoverToFolder(subFolder, pathType) {
  const confirmMsg = translations[currentLang].confirmAddCover.replace('{folder}', subFolder || 'Root');
  if (!confirm(confirmMsg)) return;

  try {
    const btn = document.querySelector(`button[data-folder="${subFolder}"].action-add-cover`);
    if (btn) { btn.disabled = true; btn.innerText = "Processing..."; }

    const res = await fetch('/api/add-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subFolder, pathType })
    });
    const data = await res.json();

    const translatedMsg = data.message.includes('Batch cover art process completed')
      ? translations[currentLang].downloadCompleted // Or keep original message if it's dynamic
      : data.message;

    alert(data.message); // Keeping original for now to avoid losing info, but could be localized.

    // Log to logs tab if user wants to see
    if (data.logs) data.logs.forEach(l => addLog("[Library] " + l));

  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    const btn = document.querySelector(`button[data-folder="${subFolder}"].action-add-cover`);
    if (btn) { btn.disabled = false; btn.innerText = "Add Cover"; }
  }
}

// -------------------------------------------------------------
// History Logic
// -------------------------------------------------------------
const historyList = document.getElementById('history-list');

function renderHistory() {
  historyList.innerHTML = '';
  if (downloadHistory.length === 0) {
    historyList.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">No downloads yet.</div>';
    return;
  }

  // Newest first
  [...downloadHistory].reverse().forEach(entry => {
    const el = document.createElement('div');
    el.className = 'list-item';
    const color = entry.status === 'Success' ? 'var(--success-color)' : 'var(--danger-color)';
    el.innerHTML = `
            <div class="list-info">
                <div class="list-title">${entry.title}</div>
                <div class="list-sub">${entry.time} - <span style="color:${color}">${entry.status}</span></div>
            </div>
        `;
    historyList.appendChild(el);
  });
}

function addToHistory(url, status) {
  const time = new Date().toLocaleTimeString();
  downloadHistory.push({ title: url, time, status });
}

// -------------------------------------------------------------
// Downloader & Progress Logic
// -------------------------------------------------------------
// UI Elements
const formatSelect = document.getElementById("format-select");
const bitrateSelect = document.getElementById("bitrate-select");
const downloadBtn = document.getElementById("download-btn");
const subfolderInput = document.getElementById("subfolder-input");
const pathTypeSelect = document.getElementById("path-type-select");
const errorDiv = document.getElementById("subfolder-error");
const currentSubfolderSpan = document.getElementById("current-subfolder");
const themeToggle = document.getElementById("theme-toggle");

// Path Selection Logic
pathTypeSelect.value = localStorage.getItem('pathType') || 'midori';
pathTypeSelect.addEventListener("change", (e) => {
  localStorage.setItem('pathType', e.target.value);
  refreshLibrary();
});

// Progress Elements
const progressWrapper = document.getElementById("progress-wrapper");
const totalProgressGroup = document.getElementById("total-progress-group");
const totalProgressBar = document.getElementById("total-progress-bar");
const totalProgressText = document.getElementById("total-progress-text");
const currentProgressBar = document.getElementById("current-progress-bar");
const currentProgressText = document.getElementById("current-progress-text");

// Theme Toggle
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-theme");
  const isLight = document.body.classList.contains("light-theme");
  themeToggle.textContent = isLight ? "🌙" : "☀";
});

// Format Parsing
formatSelect.addEventListener("change", (e) => {
  if (e.target.value === "wav") {
    bitrateSelect.disabled = true;
    bitrateSelect.title = "Lossless format";
  } else {
    bitrateSelect.disabled = false;
    bitrateSelect.title = "";
  }
});

// Input Validation & Path Preview
function updatePathPreview() {
  const val = subfolderInput.value;
  const pathType = pathTypeSelect.value;

  let baseStr = "";
  if (pathType === 'midori') baseStr = "~/Documents/midori/downloads/";
  else if (pathType === 'downloads') baseStr = "~/Downloads/";
  else baseStr = "./downloads/";

  currentSubfolderSpan.innerText = baseStr + val;

  const forbiddenChars = /[<>:"/\\|?*]/;
  if (forbiddenChars.test(val)) {
    errorDiv.innerText = 'Invalid: < > : " / \\ | ? *';
    downloadBtn.disabled = true;
  } else {
    errorDiv.innerText = '';
    downloadBtn.disabled = false;
  }
}

subfolderInput.addEventListener("input", updatePathPreview);
pathTypeSelect.addEventListener("change", updatePathPreview);

// Path Selection Logic
pathTypeSelect.value = localStorage.getItem('pathType') || 'midori';
pathTypeSelect.addEventListener("change", (e) => {
  localStorage.setItem('pathType', e.target.value);
  refreshLibrary();
  updatePathPreview(); // Update path preview when path type changes
});
updatePathPreview(); // Initial call

// Corrected Progress Update Function
function updateProgress(line) {
  if (!line) return;

  // 1. Detect Playlist Progress "Downloading item X of Y"
  const playlistMatch = line.match(/Downloading item (\d+) of (\d+)/);
  if (playlistMatch) {
    const currentItem = parseInt(playlistMatch[1], 10);
    const totalItems = parseInt(playlistMatch[2], 10);

    totalProgressGroup.style.display = 'block';
    progressWrapper.style.opacity = '1';

    const percent = (currentItem / totalItems) * 100;
    totalProgressBar.style.width = `${percent}%`;
    totalProgressText.textContent = `${currentItem} of ${totalItems}`;
    return;
  }

  // 2. Detect Item Progress
  const progressMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
  if (progressMatch) {
    const percent = parseFloat(progressMatch[1]);

    progressWrapper.style.opacity = '1';
    currentProgressBar.style.width = `${percent}%`;
    currentProgressText.innerText = `${percent.toFixed(1)}%`;
  }

  // 3. Detect Sleeping State
  const sleepMatch = line.match(/Sleeping (\d+(?:\.\d+)?) seconds/);
  if (sleepMatch) {
    const seconds = sleepMatch[1];
    progressWrapper.style.opacity = '1';
    currentProgressText.innerText = `Waiting (${seconds}s)...`;
    return;
  }

  // 4. Reset on Completion
  if (line.includes('100%')) {
    currentProgressBar.style.width = '100%';
    currentProgressText.innerText = 'Completed';
  }
}

// Corrected Start Download Function
async function startDownload() {
  const url = document.getElementById('url-input').value;
  const subFolder = document.getElementById('subfolder-input').value;
  const format = document.getElementById('format-select').value;
  const bitrate = document.getElementById('bitrate-select').value;
  const pathType = document.getElementById('path-type-select').value;

  if (!url) {
    alert("Please enter a URL.");
    return;
  }

  // Reset UI
  currentProgressBar.style.width = '0%';
  currentProgressText.innerText = '0%';
  totalProgressBar.style.width = '0%';
  totalProgressGroup.style.display = 'none';
  totalProgressText.textContent = '';
  clearLogs(); // Use helper

  document.getElementById('download-btn').disabled = true;

  try {
    const params = new URLSearchParams({ url, subFolder, format, pathType });
    if (format === 'mp3') params.append('bitrate', bitrate);

    const response = await fetch(`/api/download?${params.toString()}`);
    if (!response.ok) throw new Error("Connection failed");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        addLog(line); // Use helper

        // Update Progress
        updateProgress(line);
      }
    }

    alert(translations[currentLang].downloadCompleted);
    addToHistory(url, "Success");

  } catch (error) {
    const errorMsg = translations[currentLang].error + ": " + error.message;
    alert(errorMsg);
    addToHistory(url, `Failed: ${error.message}`);
    addLog(errorMsg);
  } finally {
    document.getElementById('download-btn').disabled = false;
    setTimeout(() => { progressWrapper.style.opacity = '0'; }, 10000);
  }
}

// Download Handler
document.getElementById("download-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  startDownload();
});

document.getElementById("paste-url-button").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById("url-input").value = text;
  } catch (err) { /* ignore */ }
});


// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
const statusSpan = document.getElementById("ytdlp-status");
const statusDot = document.getElementById("ytdlp-status-dot");
const updateBtn = document.getElementById("update-ytdlp-btn");

async function checkYtDlpStatus() {
  statusSpan.innerText = "Check...";
  statusDot.className = "status-dot";
  try {
    const res = await fetch('/api/yt-dlp/status');
    const data = await res.json();
    if (data.installed) {
      statusSpan.innerText = `Ready (v${data.version || '?'})`;
      statusDot.classList.add("active");
      updateBtn.innerText = "Update";
    } else {
      statusSpan.innerText = translations[currentLang].noYtDlp;
      updateBtn.innerText = translations[currentLang].install;
    }
  } catch (e) { statusSpan.innerText = translations[currentLang].error; }
}

async function updateYtDlp() {
  updateBtn.disabled = true;
  updateBtn.innerText = "...";
  try {
    const res = await fetch('/api/yt-dlp/update', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      checkYtDlpStatus();
    }
    else alert(data.message);
  } catch (e) {
    alert(e.message);
  }
  finally {
    updateBtn.disabled = false;
  }
}

updateBtn.addEventListener("click", updateYtDlp);

checkYtDlpStatus();
showTutorial(); // Trigger tutorial check on init