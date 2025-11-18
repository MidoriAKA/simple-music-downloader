document.getElementById("download-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const body = document.querySelector("body");
  const url = document.getElementById("url-input").value;
  const outputPath = document.getElementById("directory-input").value;
  const downloadButton = document.getElementById("download-btn");
  const logContainer = document.getElementById("logs-container");
  const logs = document.getElementById("logs");

  const toggleButton = (isDisabled) => {
    downloadButton.disabled = isDisabled;
    downloadButton.innerText = isDisabled ? "" : "Download";
    downloadButton.classList.toggle("button-downloading");
  }
  toggleButton(true);
  body.classList.toggle("noScroll");

  if (!outputPath) {
    alert("Please select a save directory.");
    return;
  }

  try {
    const message = await window.electronAPI.downloadVideo({ url, outputPath });
    alert(message);
  } catch (error) {
    alert(error);
  }
  toggleButton(false);
  body.classList.toggle("noScroll");
  // logContainer.style.display = "none";
  logs.innerText = "";
});

document.getElementById("paste-url-button").addEventListener("click", async () => {
  const url = await window.electronAPI.pasteFromClipboard();
  document.getElementById("url-input").value = url;
});

document.getElementById("select-directory-button").addEventListener("click", async () => {
  const directory = await window.electronAPI.selectDirectory();
  if (directory) {
    document.getElementById("directory-input").value = directory[0];
  }
});

document.getElementById("select-directory-button-cover").addEventListener("click", async () => {
  const directory = await window.electronAPI.selectDirectory();
  if (directory) {
    document.getElementById("directory-input-cover").value = directory[0];
    alert(directory[1]);
  }
});

// フォーム送信イベント
document.getElementById("add-cover-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const directoryInput = document.getElementById("directory-input-cover").value;

  try {
    const message = await window.electronAPI.addCover(directoryInput);
    alert(message);
  } catch (error) {
    alert(error);
  }
});


window.electronAPI.onReceiveLog((data) => {
  const logContainer = document.getElementById("logs-container");
  const foreground = document.getElementById("foreground");
  logContainer.style.display = "flex";
  const logs = document.getElementById("logs");
  const newLog = data + "\n";
  logs.appendChild(document.createTextNode(newLog));
  foreground.scrollTop = foreground.scrollHeight;
});