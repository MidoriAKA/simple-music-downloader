document.getElementById('download-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = document.getElementById('url-input').value;
  const outputPath = document.getElementById('directory-input').value;
  const isPlaylist = document.getElementById('is-playlist').checked;

  if (!outputPath) {
    alert("Please select a save directory.");
    return;
  }

  try {
    const message = await window.electronAPI.downloadVideo({ url, isPlaylist, outputPath });
    alert(message);
  } catch (error) {
    alert(error);
  }
});

document.getElementById('select-directory-button').addEventListener('click', async () => {
  const directory = await window.electronAPI.selectDirectory();
  if (directory) {
    document.getElementById('directory-input').value = directory[0];
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
document.getElementById('add-cover-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const directoryInput = document.getElementById('directory-input-cover').value;

  try {
    const message = await window.electronAPI.addCover(directoryInput);
    alert(message);
  } catch (error) {
    alert(error);
  }
});


