let editor = null;
let debounceTimer = null;
let pyodide = null; // Global variable to hold the Pyodide instance
let currentSuggestion = ''; // To store the current suggestion globally
let suggestionActive = false; // To track if a suggestion is currently active
let ghostTextRanges = []; // Store the ghost text ranges so we can remove them correctly

// Object to store file names and their content
const files = {
  'file1.py': 'print("Hello, World!")',
  'file2.py': 'def add(a, b):\n    return a + b'
};
let currentFile = 'file1.py'; // The currently active file

document.addEventListener('DOMContentLoaded', () => {
  const outputElement = document.getElementById('output');

  // Set initial content for the output area
  outputElement.innerHTML = `
    <strong>Output:</strong><br>
    Click on <strong>RUN</strong> button to see the output.
  `;
});


document.addEventListener('DOMContentLoaded', () => {
  const addFileButton = document.querySelector('.add-file-btn');
  const fileTree = document.querySelector('.file-tree');
  const editorElement = document.getElementById('editor');
  const runCodeBtn = document.querySelector('.run-btn');  // Button to run code
  const outputElement = document.getElementById('output');  // Where output will be shown

  // Initialize CodeMirror editor
  if (editorElement) {
    editor = CodeMirror.fromTextArea(editorElement, {
      mode: 'python',
      lineNumbers: true,
      theme: 'monokai',
    });

    // Load the content of the initial file into the editor
    editor.setValue(files[currentFile]);

    // Add a keyup event listener to detect user typing
    editor.on('keyup', (cm, event) => {
      const content = cm.getValue();
      // Start debounce timer (wait for the user to stop typing)
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('User stopped typing, sending to API for suggestion');
        sendToApiForSuggestion(content);  // Call the API to get suggestions
      }, 1500);  // Wait for 1500ms after the user stops typing
    });

    // Handle Tab key to confirm the suggestion
    editor.on('keydown', (cm, event) => {
      if (event.key === 'Tab' && currentSuggestion && suggestionActive) {
        event.preventDefault();
        console.log('Tab pressed, confirming suggestion');
        confirmSuggestion();  // Confirm the suggestion and make it part of the actual code
      }
    });

    // Load Pyodide before using it
    loadPyodideInstance().then(() => {
      console.log("Pyodide loaded successfully.");
    }).catch(error => {
      console.error("Error loading Pyodide:", error);
    });

    // Run Python code locally using Pyodide
    runCodeBtn.addEventListener('click', async () => {
      let code = getCleanedCode();  // Get code without ghost text
      if (!code.trim()) {
        alert('Please enter some code to run.');
        return;
      }

      // Clear the output before running the new code
      outputElement.textContent = '';

      try {
        // Ensure Pyodide is loaded before running the code
        if (!pyodide) {
          outputElement.textContent = "Pyodide is not loaded yet. Please wait...";
          console.error("Pyodide is not loaded yet.");
          return;
        }

        console.log("Executing Python code...");

        // Capture the print output by redirecting stdout to a string
        pyodide.runPython(`
          import sys
          from io import StringIO
          sys.stdout = StringIO()
        `);

        // Run the Python code
        await pyodide.runPythonAsync(code);

        // Fetch the output from stdout and display it
        const result = pyodide.runPython("sys.stdout.getvalue()");
        outputElement.textContent = result || 'Code executed with no output.';
      } catch (error) {
        console.error("Error executing Python code:", error);
        outputElement.textContent = 'Error: ' + error;
      }
    });

  } else {
    console.error('Editor element not found.');
  }

  // Function to switch the editor content based on the selected file
  function loadFileContent(fileName) {
    if (files[fileName]) {
      editor.setValue(files[fileName]);  // Load file content into the editor
    } else {
      editor.setValue('');  // If it's a new file, initialize with empty content
    }
    currentFile = fileName;  // Set the current file
  }

  // Event listener for clicking on a file
  fileTree.addEventListener('click', (e) => {
    if (e.target && e.target.matches('.file-item')) {
      const selectedFile = e.target.textContent.trim();

      // Save the current file's content before switching
      files[currentFile] = editor.getValue();

      // Switch to the selected file
      loadFileContent(selectedFile);

      // Update the selected file class
      document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('selected');
      });
      e.target.classList.add('selected');
    }
  });
});

// Function to load Pyodide and assign it to the global variable
async function loadPyodideInstance() {
  try {
    console.log("Loading Pyodide...");
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.21.3/full/"
    });
    console.log("Pyodide loaded and ready.");
  } catch (error) {
    console.error("Failed to load Pyodide:", error);
    throw error;  // Ensure that we don't proceed if loading fails
  }
}

// Function to call the API for suggestions
function sendToApiForSuggestion(content) {
  const cursor = editor.getCursor();  // Get the current cursor position
  const currentLine = editor.getLine(cursor.line);  // Get the current line of code

  if (!currentLine.trim()) return;  // Avoid sending empty or incomplete lines to the API

  // Prepare the API request
  const apiUrl = 'http://127.0.0.1:5001/v2/chat/';

  const data = {
    "user_id": "sudheersrinivasa7@gmail.com",
    "agent_id": "66f3c0124843e0f97bb0aa0d",
    "session_id": "323451c7-1f4a-4637-aac4-e0bd65792667",
    "message": currentLine  // Send only the current line of the editor as the message
  };

  fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(data => {
    if (data && data.response) {
      const suggestion = extractCodeFromResponse(data.response);
      showAutocompleteSuggestion(suggestion);  // Show as a hint, not append
    }
  })
  .catch(error => {
    console.error('Error fetching autocomplete suggestion:', error);
  });
}

// Function to extract code from the response
function extractCodeFromResponse(response) {
  return response.trim();
}

// Function to confirm the suggestion when Tab is pressed
function confirmSuggestion() {
  if (currentSuggestion) {
    console.log('Converting ghost text to actual code');

    // Remove ghost text styling and make it part of the actual code
    ghostTextRanges.forEach((range) => {
      console.log('Clearing ghost text at range:', range.find()); 
      range.clear();  // Clear the ghost text styling, converting it into regular text
    });

    ghostTextRanges = [];  // Clear the ranges as the ghost text is now actual code
    currentSuggestion = '';  // Clear the current suggestion
    suggestionActive = false;  // Mark the suggestion as inactive
  }
}

// Function to remove ghost text (in case it's needed elsewhere, like clearing without confirmation)
function removeGhostText() {
  if (ghostTextRanges.length) {
    ghostTextRanges.forEach((range) => range.clear());  // Clear all ghost text
    ghostTextRanges = [];
  }
}


function showAutocompleteSuggestion(suggestion) {
  if (suggestion === "# No suggestion available") {
    console.log('Skipping suggestion.');
    return;
  }

  const cursor = editor.getCursor();  // Get the current cursor position
  const currentLine = editor.getLine(cursor.line);  // Get the current line of code

  // Check if we're inside a function or block (line ends with ':')
  const insideFunction = currentLine.trim().endsWith(':');

  // Split suggestion into multiple lines
  const suggestionLines = suggestion.split('\n');
  const currentIndentation = currentLine.match(/^\s*/)[0];  // Get current line's indentation

  removeGhostText();  // Clear previous ghost text if it exists

  // Loop through each suggestion line and insert it into the correct location
  suggestionLines.forEach((line, i) => {
    let indentedLine = line.trim();

    // If inside a function or block, we need to indent the suggestion properly
    if (insideFunction) {
      indentedLine = `${currentIndentation}    ${line.trim()}`;  // Indent suggestion (4 spaces extra)
    }

    // Insert the suggestion below the current line
    const lineIndex = cursor.line + i + 1;  // Place the suggestion on the next line
    editor.replaceRange(`\n${indentedLine}`, { line: lineIndex, ch: 0 });

    // Mark the text as ghost text (not yet confirmed by user)
    const range = editor.markText(
      { line: lineIndex, ch: 0 },
      { line: lineIndex, ch: indentedLine.length },
      { className: "ghost-suggestion" }
    );
    ghostTextRanges.push(range);  // Track ghost text ranges for removal later
  });
  currentSuggestion = suggestion;  // Store the current suggestion
  suggestionActive = true;
}


function getCleanedCode() {
  const doc = editor.getDoc();
  let code = editor.getValue();  // Get the full code including ghost text

  // Skip cleaning if no ghost text ranges exist
  if (ghostTextRanges.length === 0) {
    return code;  // No suggestions to clean, return the code as-is
  }

  // Loop over ghost text ranges and remove them from the code
  ghostTextRanges.forEach((range) => {
    const foundRange = range.find();  // Get the start and end of the range
    if (foundRange) {  // Check if the range is valid before accessing 'from' and 'to'
      const { from, to } = foundRange;
      code = code.replace(doc.getRange(from, to), '');  // Remove the ghost text
    }
  });

  return code;
}


// Add custom CSS to display suggestions in lighter grey
const suggestionStyle = document.createElement('style');
suggestionStyle.innerHTML = `
  .CodeMirror .ghost-suggestion {
    color: rgba(211, 211, 211, 0.7) !important;
    font-style: italic !important;
  }
`;
document.head.appendChild(suggestionStyle);
