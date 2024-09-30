let editor = null;
let debounceTimer = null;
let suggestionInterval = null;  // To store the interval for making API calls every 30 seconds

document.addEventListener('DOMContentLoaded', () => {
  // Initialize CodeMirror editor
  const editorElement = document.getElementById('editor');
  if (editorElement) {
    editor = CodeMirror.fromTextArea(editorElement, {
      mode: 'python',
      lineNumbers: true,
      theme: 'monokai',
    });

    // Add a keyup event listener to detect user typing
    editor.on('keyup', (cm, event) => {
      const content = cm.getValue();
      // Start debounce timer (wait for the user to stop typing)
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        sendToApiForSuggestion(content);  // Call the API to get suggestions
      }, 1000);  // Wait for 500ms after the user stops typing
    });

    // Set an interval to send API requests every 30 seconds
    suggestionInterval = setInterval(() => {
      const content = editor.getValue();  // Get current editor content
      sendToApiForSuggestion(content);  // Send content to API for suggestions
    }, 30000);  // 30 seconds interval

  } else {
    console.error('Editor element not found.');
  }
});

// Function to call the API for suggestions
function sendToApiForSuggestion(content) {
  if (!content.trim()) return;  // Avoid sending empty content to the API

  // Prepare the API request
  const apiUrl = 'https://agent.api.lyzr.app/v2/chat/';
  const data = {
    "user_id": "sudheersrinivasa7@gmail.com",
    "agent_id": "66f3c0124843e0f97bb0aa0d",
    "session_id": "323451c7-1f4a-4637-aac4-e0bd65792667",
    "message": content  // Send the current content of the editor as the message
  };

  // Log the message being sent to the API
  console.log('Sending to API:', data.message);

  fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'lyzr-MymGQNwvOA6qWpWde9glJ0Zy'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(data => {
    console.log('API Response:', data);
    if (data && data.response) {
      const suggestion = extractCodeFromResponse(data.response);
      showAutocompleteSuggestion(suggestion);  // Show as a hint, not append
    } else {
      console.warn('No suggestions returned from the API.');
    }
  })
  .catch(error => {
    console.error('Error fetching autocomplete suggestion:', error);
  });
}

// Function to extract code from the response, removing backticks and extra formatting
function extractCodeFromResponse(response) {
  const code = response.replace(/```[a-zA-Z]*\n?/, '').replace(/```/, '').trim();
  return code;
}

// Function to display the autocomplete suggestion as a hint without adding it to the editor
function showAutocompleteSuggestion(suggestion) {
  const cursor = editor.getCursor();  // Get the cursor position
  CodeMirror.showHint(editor, function() {
    return {
      list: [{ text: suggestion, displayText: suggestion }],  // Suggest the extracted suggestion
      from: cursor,  // Start suggestion from the cursor
      to: cursor,  // End the suggestion at the cursor
      completeSingle: false  // Disable automatic completion
    };
  });
}
