document.addEventListener('DOMContentLoaded', () => {
    const addFileButton = document.querySelector('.add-file-btn');
    const fileTree = document.querySelector('.file-tree');
    const files = {}; // Object to store file names and their content
    let currentFile = ''; // The currently active file
  
    // Function to add a new file to the sidebar
    function addFileToTree(fileName) {
      // Prevent duplicates by checking if the file already exists
      if (files[fileName]) {
        alert(`File "${fileName}" already exists!`);
        return;
      }
  
      const fileItem = document.createElement('li');
      fileItem.classList.add('file-item');
      fileItem.innerHTML = `
        <span class="file-name">${fileName}</span>
        <span class="edit-file"><i class="fas fa-pencil-alt"></i></span>
        <span class="delete-file"><i class="fas fa-trash-alt"></i></span>
      `;
      fileTree.appendChild(fileItem);
  
      attachFileItemListeners(fileName, fileItem);  // Attach listeners to the file
      files[fileName] = ''; // New empty file content
    }
  
    // Function to attach event listeners to file items (for edit and delete)
    function attachFileItemListeners(fileName, fileItem) {
      // Attach delete event listener
      const deleteBtn = fileItem.querySelector('.delete-file');
      deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent file selection when deleting
        deleteFile(fileName, fileItem);
      });
  
      // Attach rename event listener
      const editBtn = fileItem.querySelector('.edit-file');
      editBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent file selection when renaming
        renameFile(fileName, fileItem);
      });
  
      // Attach event listener to select file
      fileItem.addEventListener('click', () => selectFile(fileName, fileItem));
    }
  
    // Event listener for the add file button
    addFileButton.addEventListener('click', () => {
      const newFileName = prompt('Enter the name of the new file (e.g., script.py):');
  
      if (newFileName && newFileName.trim()) {
        addFileToTree(newFileName.trim()); // Add the new file to the sidebar
      } else {
        alert('Please enter a valid file name.');
      }
    });
  
    // Delete file function
    function deleteFile(fileName, fileItem) {
      if (confirm(`Are you sure you want to delete ${fileName}?`)) {
        delete files[fileName]; // Remove the file from the `files` object
        fileItem.remove(); // Remove from the UI
  
        if (fileName === currentFile) {
          currentFile = Object.keys(files)[0] || '';
          loadFileContent(currentFile); // Load another file or clear editor if no files remain
        }
      }
    }
  
    // Rename file function
    function renameFile(oldFileName, fileItem) {
      const newFileName = prompt('Enter the new name for the file:', oldFileName);
  
      if (newFileName && newFileName.trim() && newFileName !== oldFileName) {
        if (files[newFileName]) {
          alert('A file with this name already exists.');
          return;
        }
  
        // Update the files object and the UI
        files[newFileName] = files[oldFileName];
        delete files[oldFileName];
        fileItem.querySelector('.file-name').textContent = newFileName;
  
        if (oldFileName === currentFile) {
          currentFile = newFileName;
        }
      } else {
        alert('Please enter a valid file name.');
      }
    }
  
    // Select file function
    function selectFile(fileName, fileItem) {
      if (fileName === currentFile) return; // Avoid reloading the same file
  
      saveCurrentFile(); // Save the current file's content before switching
      loadFileContent(fileName); // Load the selected file content
  
      // Update the selected file class
      document.querySelectorAll('.file-item').forEach(item => item.classList.remove('selected'));
      fileItem.classList.add('selected');
    }
  
    // Save the current file content
    function saveCurrentFile() {
      if (currentFile) {
        files[currentFile] = editor.getValue(); // Save editor content to the current file
      }
    }
  
    // Load file content into the editor
    function loadFileContent(fileName) {
      if (files[fileName]) {
        editor.setValue(files[fileName]); // Load file content into the editor
        currentFile = fileName;
      } else {
        editor.setValue(''); // If no file, clear the editor
      }
    }
  
    // Add initial files to the file tree and attach event listeners
    document.querySelectorAll('.file-item').forEach(fileItem => {
      const fileName = fileItem.querySelector('.file-name').textContent;
      attachFileItemListeners(fileName, fileItem); // Attach listeners to each pre-existing file
      files[fileName] = ''; // Store the initial files as empty for now
    });
  });
  