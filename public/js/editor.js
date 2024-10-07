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
// When you receive the cleaned code from verifyLyzrSuggestion
async function handleLyzrSuggestion() {
  const fullCode = editor.getValue();  // Get the current content of the editor
  console.log("Received code before Lyzr-AI suggestion:", fullCode);

  // Step 1: Verify the Lyzr suggestion using OpenAI (cleaning the code)
  const lyzrOutput = await verifyLyzrSuggestion(fullCode);  // Removed extra argument 'lyzrOutput'
  console.log("Verified Lyzr Output:", lyzrOutput);

  if (lyzrOutput) {
    // Step 2: Suggest the cleaned and verified Lyzr output to the editor
    showAutocompleteSuggestion(lyzrOutput);
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
    "user_id": "mahithanaidu00@gmail.com",
    "agent_id": "6703ba01a929339fb3238ad0",
    "session_id": "767bc0c9-9c18-4896-99bc-cd71a9a70bb0",
    "message": fullCode  // Send the entire content of the editor as the message
  };

  fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'lyzr-q5hOjOIWxTdGhYCZe1hWcfjr'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(async data => {
    if (data && data.response) {
      const lyzrOutput = extractCodeFromResponse(data.response);

      console.log("Lyzr Output Received:", lyzrOutput);

      // Verify the suggestion using OpenAI before applying it
      const verifiedCode = await verifyLyzrSuggestion(fullCode, lyzrOutput);

      showAutocompleteSuggestion(verifiedCode);  // Show as a hint, not append
    }
  })
  .catch(error => {
    console.error('Error fetching autocomplete suggestion:', error);
  });
}

async function verifyLyzrSuggestion(fullCode, lyzrOutput) {
  const apiUrl = 'https://api.openai.com/v1/chat/completions';
  const openAiApiKey = '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';  // Replace with your actual API key

  const requestBody = {
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": `You are given two inputs. The first input is the 'fullCode' that the user has written. The second input is the 'lyzrOutput' generated by an autocomplete agent. Your task is to validate and clean the 'lyzrOutput'. Follow these rules:

1. **Do not return any lines already present in 'fullCode'.**
2. **Ensure correct Python indentation** is maintained in the 'lyzrOutput'.
3. **Return only valid Python code**. No comments, no explanations, no English sentences, no extra text, and no code blocks or markdown. **Return just the clean Python code.**
4. **If there is no valid code in 'lyzrOutput', return an empty string.**
5. **Do not return any empty code blocks.**

Full code:
${fullCode}

Lyzr Output:
${lyzrOutput}

Return only valid, cleaned Python code, and nothing else. If no valid code exists, return an empty string (no text).`
      }
    ],
    "max_tokens": 500,
    "temperature": 0.2
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();
    if (responseData.choices && responseData.choices.length > 0) {
      let content = responseData.choices[0].message.content;

      // Ensure only valid Python code is kept
      content = extractCodeFromResponse(content);

      // If necessary, apply indentation correction
      content = fixIndentation(content);

      console.log("Final verified code after OpenAI processing:", content);

      // Use `filterRepeatedLines` to filter out repeated lines from `content`
      const cleanedContent = filterRepeatedLines(fullCode, content);

      // Return the cleaned and filtered content
      return cleanedContent;
    } else {
      console.error('Error in OpenAI response:', responseData);
      return '';  // Return an empty string if OpenAI fails or no valid code is returned
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return '';  // Return an empty string on error
  }
}



// Function to extract code without unnecessary comments or explanations
function extractCodeFromResponse(content) {
  // Extract the actual code from within code blocks
  const codeBlockMatch = content.match(/```python([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1]; // Return the content inside the code block
  }
  return content.replace(/The 'lyzrOutput'.+/, '').trim();  // Fallback: remove unnecessary comments and return
}

// Function to fix the indentation of the entire block
function fixIndentation(code) {
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
      // Increase the indentation level after a colon (e.g., function or loop declaration)
      fixedCode += ' '.repeat(indentLevel) + trimmedLine + '\n';
      indentLevel += indentSize;
    } else if (trimmedLine.startsWith('return') || trimmedLine.startsWith('else') || trimmedLine.startsWith('elif')) {
      // Decrease the indentation level for return, else, and elif
      indentLevel = Math.max(0, indentLevel - indentSize);
      fixedCode += ' '.repeat(indentLevel) + trimmedLine + '\n';
    } else {
      // Apply normal indentation
      fixedCode += ' '.repeat(indentLevel) + trimmedLine + '\n';
    }
  });

  return fixedCode;
}


// Function to filter out lines that are already present in fullCode
function filterRepeatedLines(fullCode, lyzrOutput) {
  const fullCodeLines = fullCode.split('\n').map(line => line.trim());
  const outputLines = lyzrOutput.split('\n');

  const filteredOutput = outputLines.filter(line => {
    // Do not include lines that are already present in the original code
    return !fullCodeLines.includes(line.trim());
  });

  return filteredOutput.join('\n');
}

// Function to confirm the suggestion when Tab is pressed
async function confirmSuggestion() {
  if (currentSuggestion) {
    console.log('Converting ghost text to actual code');

    // Step 1: Get the current code from the editor
    let fullCode = editor.getValue();
    
    try {
      // Step 2: Call the Flask API to format the code
      const formattedCode = await callFormatCodeApi(fullCode);

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
// Function to handle indentation and spaces after newlines (\n)
function handleIndentationAndSpaces(code) {
  // Split the code into individual lines based on newline characters (\n)
  let lines = code.split('\n');
  
  // Variables to keep track of the indentation level and formatted code
  let indentLevel = 0;
  const indentSize = 4; // Assuming 4 spaces for Python indentation
  let formattedCode = '';

  // Loop through each line to adjust the indentation and format it
  lines.forEach((line, index) => {
    let trimmedLine = line.trim();

    if (trimmedLine === '') {
      // Preserve empty lines, keep the newline without adding spaces
      formattedCode += '\n';
      return;
    }

    // Check for keywords that affect indentation (increase/decrease)
    if (trimmedLine.endsWith(':')) {
      // If the line ends with a colon, increase the indentation level for the next line
      formattedCode += ' '.repeat(indentLevel) + trimmedLine + '\n';
      indentLevel += indentSize;
    } else if (trimmedLine.startsWith('return') || trimmedLine.startsWith('else') || trimmedLine.startsWith('elif')) {
      // Decrease the indentation level for certain keywords
      indentLevel = Math.max(0, indentLevel - indentSize);
      formattedCode += ' '.repeat(indentLevel) + trimmedLine + '\n';
    } else {
      // Normal line, apply the current indentation level
      formattedCode += ' '.repeat(indentLevel) + trimmedLine + '\n';
    }
  });

  // Return the properly formatted code with correct indentation and newlines
  return formattedCode;
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

