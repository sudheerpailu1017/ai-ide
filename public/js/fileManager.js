let selectedFile = null;  // Track the currently selected file
let isSaving = false;     // Prevent conflicts during save and switch

document.addEventListener('DOMContentLoaded', () => {
  // Add event listener to the create file button
  document.querySelector('.create-file-btn').addEventListener('click', createFile);

  // Add event listener to the delete file button
  document.querySelector('.delete-file-btn').addEventListener('click', deleteFile);

  // Load the list of files on page load
  refreshFileList();
});

// Function to refresh the file list and add click listeners to each file
function refreshFileList() {
  fetch('/file/list')
    .then(response => response.json())
    .then(data => {
      const fileTree = document.querySelector('.file-tree');
      fileTree.innerHTML = '';  // Clear the existing list

      // Populate file list and add click event listeners for each file
      data.files.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file;
        li.addEventListener('click', () => selectFile(file, li));  // Add click event for file selection
        fileTree.appendChild(li);
      });
    })
    .catch(error => console.error('Error fetching file list:', error));
}

// Function to select a file and load its content into the editor
function selectFile(fileName, fileElement) {
  if (isSaving) {
    return;  // Prevent switching while saving
  }

  if (selectedFile) {
    // Save current file before switching to a new one
    saveCurrentFile(() => {
      // After saving, load the new file
      switchFile(fileName, fileElement);
    });
  } else {
    // If no file is currently selected, just load the new file
    switchFile(fileName, fileElement);
  }
}

// Function to handle the logic of switching files
function switchFile(fileName, fileElement) {
  if (selectedFile) {
    selectedFile.classList.remove('selected');  // Remove selected class from previously selected file
  }
  fileElement.classList.add('selected');  // Add selected class to the current file
  selectedFile = fileElement;

  // Fetch the file's content and load it into the editor
  fetch(`/file/read?filename=${fileName}`)
    .then(response => response.json())
    .then(data => {
      const editor = window.editor;
      if (editor && data.content) {
        editor.setValue(data.content);  // Load the content of the selected file into the editor
      } else {
        editor.setValue('');  // Clear editor if no content is found
      }
    })
    .catch(error => console.error('Error reading file:', error));
}

// Function to save the current file before switching to another
function saveCurrentFile(callback) {
  if (!selectedFile) return;

  const editor = window.editor;
  const content = editor.getValue();  // Get the content of the current file
  const fileName = selectedFile.textContent;

  isSaving = true;  // Prevent switching while saving
  fetch('/file/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename: fileName, content: content })
  })
  .then(response => response.json())
  .then(data => {
    console.log(`File ${fileName} saved successfully.`);
    isSaving = false;  // Allow switching again
    if (callback) callback();  // Call the callback function after saving
  })
  .catch(error => {
    console.error('Error saving file:', error);
    isSaving = false;  // Allow switching again even if there's an error
    if (callback) callback();  // Call the callback function even if there's an error
  });
}

// Function to create a new file
function createFile() {
  const fileName = prompt('Enter new file name:');
  if (fileName) {
    fetch('/file/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename: fileName })
    })
    .then(response => response.json())
    .then(data => {
      console.log(data);
      refreshFileList();  // Refresh the file list after creating the file
    })
    .catch(error => console.error('Error creating file:', error));
  }
}

// Function to delete the selected file
function deleteFile() {
  if (!selectedFile) {
    alert('Please select a file to delete.');
    return;
  }

  const fileName = selectedFile.textContent;  // Get the selected file's name
  fetch('/file/delete', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename: fileName })
  })
  .then(response => response.json())
  .then(data => {
    console.log(data);
    refreshFileList();  // Refresh the file list after deletion
    window.editor.setValue('');  // Clear the editor after deleting the file
    selectedFile = null;  // Reset the selected file after deletion
  })
  .catch(error => console.error('Error deleting file:', error));
}
