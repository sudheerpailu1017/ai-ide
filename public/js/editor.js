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

// Initialize the socket connection to listen for real-time updates

document.addEventListener('DOMContentLoaded', () => {
  const addFileButton = document.querySelector('.add-file-btn');
  const fileTree = document.querySelector('.file-tree');
  const editorElement = document.getElementById('editor');
  const runCodeBtn = document.querySelector('.run-btn');  // Button to run code
  const lyzrAiBtn = document.querySelector('.ai-btn');  // "Write with Lyzr-AI" button
  const outputElement = document.getElementById('output');  // Where output will be shown

  // Initialize CodeMirror editor
  if (editorElement) {
    editor = CodeMirror.fromTextArea(editorElement, {
      mode: 'python',
      lineNumbers: true,
      theme: 'monokai',
    });

    const socket = io('http://127.0.0.1:5000');  // Connect to Flask-SocketIO server

    // Listen for 'clear_editor' event from the server
    socket.on('clear_editor', (data) => {
      const newCode = data.new_code || '';
      if (editor) {
        editor.setValue(newCode);  // Clear the editor content
        console.log("Editor cleared via WebSocket.");
      } else {
        console.error("Editor instance not found!");
      }
    });

    // Load the content of the initial file into the editor
    editor.setValue(files[currentFile]);

    // Handle Tab key to confirm the suggestion
    editor.on('keydown', (cm, event) => {
      if (event.key === 'Tab' && currentSuggestion && suggestionActive) {
        event.preventDefault();
        console.log('Tab pressed, confirming suggestion');
        confirmSuggestion();  // Confirm the suggestion and make it part of the actual code
      }
    });

    // Only trigger Lyzr-AI suggestion when the "Write with Lyzr-AI" button is clicked
    lyzrAiBtn.addEventListener('click', () => {
      const content = editor.getValue();  // Get the current editor content
      console.log("Sending code for Lyzr-AI suggestion:", content);  // Log the code being sent
      sendToApiForSuggestion(content);  // Call the API to get suggestions
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
});


// Function to call the /clear_code API and reset the editor content
function clearEditor() {
  const apiUrl = 'http://127.0.0.1:5000/clear_code';  // Replace with the correct Flask URL

  // Call the API to clear the editor content
  fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  .then(response => {
    if (!response.ok) {
      throw new Error("Failed to clear the editor content");
    }
    return response.json();  // Parse the JSON response
  })
  .then(data => {
    const newCode = data.new_code || '';
    if (editor) {
      // Clear the editor content
      editor.setValue(newCode);
      console.log("Editor cleared.");
    } else {
      console.error("Editor instance not found!");
    }
  })
  .catch(error => {
    console.error('Error clearing the editor:', error);
  });
}

// Function to load Pyodide
async function loadPyodideInstance() {
  try {
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
    });
    console.log("Pyodide has been successfully loaded.");

    // Enable the "Run Code" button once Pyodide is loaded
    document.querySelector('.run-btn').disabled = false;
  } catch (error) {
    console.error("Error loading Pyodide:", error);
  }
}

// Function to call the API for suggestions
function sendToApiForSuggestion(content) {
  const cursor = editor.getCursor();  // Get the current cursor position
  const fullCode = editor.getValue();  // Get the entire content of the editor

  if (!fullCode.trim()) return;  // Avoid sending empty or incomplete content to the API

  // Prepare the API request to Lyzr
  const apiUrl = 'https://agent.api.lyzr.app/v2/chat/';

  const data = {
    "user_id": "sudheer.pailu@phenom.com",
    "agent_id": "67049e29a929339fb323c06f",
    "session_id": "6e186b44-6a78-4c9c-830e-fea4f2bc8fd3",
    "message": fullCode  // Send the entire content of the editor as the message
  };

  fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'lyzr-OUmA51pO2KsqD0dQCTxf4TBq'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(async data => {
    if (data && data.response) {
      const lyzrOutput = extractCodeFromResponse(data.response);

      console.log("Lyzr Output Received:", lyzrOutput);

      // Call the API to check and update the first line if necessary
      const updatedCode = await checkAndUpdateFirstLine(fullCode, lyzrOutput);

      // Now show the updated code suggestion (if any change was made)
      showAutocompleteSuggestion(updatedCode);
    }
  })
  .catch(error => {
    console.error('Error fetching autocomplete suggestion:', error);
  });
}

async function checkAndUpdateFirstLine(existingCode, lyzrSuggestion) {
  const apiUrl = 'http://127.0.0.1:5000/check_and_update_first_line';  // Replace with your actual endpoint

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      existing_code: existingCode,
      lyzr_suggestion: lyzrSuggestion
    })
  });

  if (!response.ok) {
    console.error('Failed to check and update the first line');
    return lyzrSuggestion;  // Return the original suggestion if the API fails
  }

  const data = await response.json();
  return data.updated_code || lyzrSuggestion;  // Return the updated code if available
}

// Function to extract code without unnecessary comments or explanations
function extractCodeFromResponse(content) {
  const codeBlockMatch = content.match(/```python([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1]; // Return the content inside the code block
  }
  return content.replace(/The 'lyzrOutput'.+/, '').trim();  // Fallback: remove unnecessary comments and return
}

// Function to confirm the suggestion when Tab is pressed
async function confirmSuggestion() {
  if (currentSuggestion) {
    console.log('Converting ghost text to actual code');
    console.log("Current suggestion:", currentSuggestion);

    // Step 1: Get the current code from the editor
    let fullCode = editor.getValue();
    console.log("Full code before formatting:", fullCode);

    try {
      // Step 2: Call the Flask API to format the code
      const formattedCode = await callFormatCodeApi(fullCode);
      console.log("Formatted code returned from API:", formattedCode);

      // Step 3: Apply the formatted code to the editor
      applyFormattedCode(formattedCode);

    } catch (error) {
      console.error('Error formatting the code:', error);
      alert('Failed to format the code. Please try again.');
    }

    // Step 4: Remove ghost text styling and make it part of the actual code
    ghostTextRanges.forEach((range) => {
      console.log('Clearing ghost text at range:', range.find());
      range.clear();  // Clear the ghost text styling, converting it into regular text
    });

    ghostTextRanges = [];  // Clear the ranges as the ghost text is now actual code
    currentSuggestion = '';  // Clear the current suggestion
    suggestionActive = false;  // Mark the suggestion as inactive
    console.log("Suggestion confirmed and applied to the code.");
  }
}



// Function to call the Flask API for code formatting
async function callFormatCodeApi(fullCode) {
  const apiUrl = 'http://127.0.0.1:5000/format_code'; // Your Flask API endpoint

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: fullCode  // Send the entire current code for formatting
    })
  });

  if (!response.ok) {
    throw new Error('Failed to format the code');
  }

  const data = await response.json();
  return handleIndentationAndSpaces(data.formatted_code);  // Process the returned code with spaces
}

// Function to apply the formatted code to the editor
function applyFormattedCode(formattedCode) {
  editor.setValue(formattedCode);  // Replace the current editor content with the formatted code
}

// Function to handle indentation and spaces after newlines (\n)
function handleIndentationAndSpaces(code) {
  const lines = code.split('\n');
  let indentLevel = 0;
  const indentSize = 4;  // Default indentation size for Python is 4 spaces
  let fixedCode = '';

  lines.forEach(line => {
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      fixedCode += '\n';
      return;
    }

    if (trimmedLine.endsWith(':')) {
      fixedCode += ' '.repeat(indentLevel) + trimmedLine + '\n';
      indentLevel += indentSize;
    } else if (trimmedLine.startsWith('return') || trimmedLine.startsWith('else') || trimmedLine.startsWith('elif')) {
      indentLevel = Math.max(0, indentLevel - indentSize);
      fixedCode += ' '.repeat(indentLevel) + trimmedLine + '\n';
    } else {
      fixedCode += ' '.repeat(indentLevel) + trimmedLine + '\n';
    }
  });

  return fixedCode;
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

  console.log("Original suggestion received from backend:", suggestion);

  const cursor = editor.getCursor();  // Get the current cursor position
  const currentLine = editor.getLine(cursor.line);  // Get the current line of code

  removeGhostText();  // Clear previous ghost text if it exists

  // Split the suggestion into lines as it may have multiple lines of code
  const suggestionLines = suggestion.split('\n');

  suggestionLines.forEach((line, i) => {
    const lineIndex = cursor.line + i;
    
    // Directly replace the current line with the suggestion
    editor.replaceRange(line + '\n', { line: lineIndex, ch: 0 });
  });

  // Move the cursor to the end of the suggestion
  const lastLine = cursor.line + suggestionLines.length - 1;
  const lastChar = suggestionLines[suggestionLines.length - 1].length;
  editor.setCursor({ line: lastLine, ch: lastChar });

  currentSuggestion = suggestion;
  suggestionActive = true;

  console.log("Suggestion applied directly from backend.");
}


function getCleanedCode() {
  const doc = editor.getDoc();
  let code = editor.getValue();

  if (ghostTextRanges.length === 0) {
    return code;
  }

  ghostTextRanges.forEach((range) => {
    const foundRange = range.find();
    if (foundRange) {
      const { from, to } = foundRange;
      code = code.replace(doc.getRange(from, to), '');
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
