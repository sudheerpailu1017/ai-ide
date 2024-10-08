from flask import Flask, render_template, request, jsonify
from api.fileOperations import file_ops
from api.executeCode import execute_code
import logging, re, requests
from openai import OpenAI
from flask_socketio import SocketIO
from flask_cors import CORS, cross_origin
import subprocess
import autopep8


app = Flask(__name__, static_folder='../public', template_folder='../templates')
socketio = SocketIO(app, cors_allowed_origins="*")  # Allow CORS if needed
CORS(app)

# Register Blueprints
app.register_blueprint(file_ops, url_prefix='/file')
app.register_blueprint(execute_code, url_prefix='/execute')

# Configure logging
logging.basicConfig(level=logging.INFO)

@app.route('/')
def home():
    return render_template('index.html')

client = OpenAI(api_key="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")

# Fallback API to check and correct code using GPT-4o-mini
def validate_and_fix_indentation(code):
    """
    Validate and fix indentation in the Python code.
    """
    # Add your custom indentation validation logic here
    lines = code.split('\n')
    indent_level = 0
    indent_size = 4
    formatted_code = ''

    for line in lines:
        trimmed_line = line.strip()
        if trimmed_line.endswith(':'):
            formatted_code += ' ' * indent_level + trimmed_line + '\n'
            indent_level += indent_size
        elif trimmed_line.startswith(('return', 'elif', 'else', 'except', 'finally')):
            indent_level = max(0, indent_level - indent_size)
            formatted_code += ' ' * indent_level + trimmed_line + '\n'
        else:
            formatted_code += ' ' * indent_level + trimmed_line + '\n'

    return formatted_code.strip()

@app.route('/fallback_code', methods=['POST'])
def fallback_code():
    data = request.get_json()
    lyzr_suggestion = data.get('lyzr_suggestion', '')

    if not lyzr_suggestion:
        return jsonify({'error': 'No Lyzr suggestion provided'}), 400

    # Create the prompt for the model
    prompt = f"""
    The following Python code needs to be checked for proper indentation. check the if and return and before returning the code make sure you share the working one if its runs then only share it.
    Return only the corrected code without adding or removing any lines.
    Do not add new code or explanations, and return only the valid, corrected Python code:

    {lyzr_suggestion}
    """

    try:
        # Call OpenAI's GPT-4o-mini to correct and reformat the code
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that corrects Python code indentation."},
                {"role": "user", "content": prompt}
            ]
        )

        # Access the message content directly
        corrected_code = completion.choices[0].message.content.strip()

        # Clean the code of any markdown code fences
        cleaned_code = clean_code_blocks(corrected_code)

        # Fix indentation issues with AutoPEP8
        formatted_code = autopep8.fix_code(cleaned_code)

        # Log the corrected code
        logging.info(f"Corrected and formatted code:\n{formatted_code}")

        # Run the code to check if it works
        if check_code_execution(formatted_code):
            return jsonify({'corrected_code': formatted_code})
        else:
            return jsonify({'error': 'The corrected code does not run successfully.'}), 400

    except Exception as e:
        logging.error(f"Error during OpenAI request: {e}")
        return jsonify({'error': 'Failed to process the request'}), 500


def check_code_execution(code):
    """
    Check if the code can be executed successfully.
    """
    try:
        # Execute the code in a separate Python process to see if it runs without errors
        exec(code, {})
        return True
    except IndentationError as e:
        logging.error(f"Indentation error in code: {e}")
        return False
    except SyntaxError as e:
        logging.error(f"Syntax error in code: {e}")
        return False
    except Exception as e:
        logging.error(f"Code execution failed: {e}")
        return False
# Function to format Python code with proper indentation and clean formatting
def format_code(code):
    lines = code.split('\n')  # Split code into individual lines
    indent_level = 0
    indent_size = 4  # Default Python indentation size (4 spaces)
    formatted_code = ''
    previous_line_ended_with_colon = False  # Track if previous line was a control statement ending with a colon
    
    for i, line in enumerate(lines):
        trimmed_line = line.strip()

        if trimmed_line == '':
            # Skip excessive empty lines (allow only one consecutive blank line)
            if i > 0 and lines[i - 1].strip() == '':
                continue
            formatted_code += '\n'
            continue

        # Handle indentation for lines that should follow control statements
        if previous_line_ended_with_colon:
            formatted_code += ' ' * indent_level + trimmed_line + '\n'
            previous_line_ended_with_colon = False
        else:
            formatted_code += ' ' * indent_level + trimmed_line + '\n'

        # Check if the current line ends with a colon (control flow structure)
        if trimmed_line.endswith(':'):
            indent_level += indent_size
            previous_line_ended_with_colon = True  # Mark that this line requires indentation for the next line

        # Handle dedentation for 'else', 'elif', 'except', 'finally', and 'return'
        if trimmed_line.startswith(('return', 'elif', 'else', 'except', 'finally')) and not trimmed_line.endswith(':'):
            indent_level = max(0, indent_level - indent_size)

    # Remove any excessive newlines at the end
    return formatted_code.rstrip() + '\n'

def clean_code_blocks(code):
    """
    Remove markdown code block tags from the code.
    """
    return code.replace('```python', '').replace('```', '').strip()

def call_fallback_for_indentation(code):
    """
    Call the fallback API to fix indentation issues and log the original and corrected code.
    """
    fallback_api_url = "http://127.0.0.1:5000/fallback_code"
    
    try:
        logging.info(f"Sending the following code to fallback API:\n{code}")
        
        # Prepare the data for the POST request
        response = requests.post(fallback_api_url, json={"lyzr_suggestion": code})
        
        if response.status_code == 200:
            # Extract the corrected code from the response
            corrected_code = response.json().get('corrected_code', code)  # Use original code if no corrected code is provided
            logging.info(f"Fallback API returned corrected code:\n{corrected_code}")
            return corrected_code
        else:
            logging.error(f"Fallback API failed with status code: {response.status_code}")
            return code  # Return the original code if the API fails

    except Exception as e:
        logging.error(f"Error calling fallback API: {e}")
        return code  # Return the original code if there's an exception

# API to format Python code
@app.route('/format_code', methods=['POST'])
def format_code_endpoint():
    data = request.get_json()
    code = data.get('code', '')

    if not code:
        return jsonify({'error': 'No code provided'}), 400

    formatted_code = format_code(code)
    return jsonify({'formatted_code': formatted_code})

# API to clear the code and notify clients via WebSocket
@app.route('/clear_code', methods=['POST'])
def clear_code():
    # Emit a WebSocket event to clear the editor for all connected clients
    socketio.emit('clear_editor', {'new_code': ''})
    
    # Return an HTTP response for the POST request
    return jsonify({"message": "Editor cleared!"})

def extract_function_name_and_signature(line):
    """Extract the function name and signature from a Python function definition."""
    match = re.match(r'\s*(def\s+\w+\s*\(.*\)\s*):', line)
    if match:
        return match.group(1)  # Return 'def function_name(...)'
    return None


def update_first_line(existing_code, lyzr_suggestion):
    # Split the existing code and Lyzr suggestion into lines
    existing_lines = existing_code.split('\n')
    suggestion_lines = lyzr_suggestion.split('\n')

    if not existing_lines or not suggestion_lines:
        logging.error("One of the code blocks is empty.")
        return existing_code  # No changes if either code block is empty

    # Extract the first lines from the existing code and Lyzr suggestion
    existing_first_line = existing_lines[0].strip()
    suggested_first_line = suggestion_lines[0].strip()

    # Call the clear_code API before making changes
    clear_api_url = "http://127.0.0.1:5000/clear_code"
    try:
        clear_response = requests.post(clear_api_url)
        if clear_response.status_code == 200:
            logging.info("Successfully cleared the editor using the clear_code API.")
        else:
            logging.error(f"Failed to clear the editor. Status code: {clear_response.status_code}")
            return existing_code  # If clearing failed, stop further execution
    except Exception as e:
        logging.error(f"Error calling clear_code API: {e}")
        return existing_code  # Stop if there's an exception

    # Check if one is a substring of the other
    if existing_first_line in suggested_first_line or suggested_first_line in existing_first_line:
        logging.info(f"Substring match found. Removing existing first line: '{existing_first_line}' and replacing with Lyzr suggestion.")

        # Identify where the function block starts and ends in the existing code
        start_idx = None
        for idx, line in enumerate(existing_lines):
            if line.strip().startswith('def '):  # Look for the function definition
                start_idx = idx
                break

        if start_idx is not None:
            # Find where the function block ends by looking for the next function definition
            end_idx = len(existing_lines)
            for idx in range(start_idx + 1, len(existing_lines)):
                if existing_lines[idx].strip().startswith('def '):  # Next function definition found
                    end_idx = idx
                    break

            # Log the lines being replaced
            logging.info(f"Replacing lines {start_idx} to {end_idx} in the existing code.")

            # Replace the existing function block with the Lyzr suggestion
            updated_lines = existing_lines[:start_idx] + suggestion_lines + existing_lines[end_idx:]
            updated_code = '\n'.join(updated_lines)

            # Call the fallback API to check and fix indentation
            updated_code = call_fallback_for_indentation(updated_code)

            # Log the updated code for verification
            logging.info(f"Updated and formatted code block after fallback:\n{updated_code}")
            return updated_code

    # If no replacement is needed, return the existing code
    logging.info("No changes made. No substring match found.")
    return existing_code

# API endpoint to check if the first line needs to be updated
@app.route('/check_and_update_first_line', methods=['POST'])
def check_and_update_first_line():
    data = request.get_json()
    existing_code = data.get('existing_code', '')
    lyzr_suggestion = data.get('lyzr_suggestion', '')
    
    logging.info(f"Existing code: {existing_code}")
    logging.info(f"Lyzr suggestion: {lyzr_suggestion}")

    if not existing_code or not lyzr_suggestion:
        return jsonify({'error': 'Both existing_code and lyzr_suggestion are required'}), 400

    updated_code = update_first_line(existing_code, lyzr_suggestion)

    return jsonify({
        'updated_code': updated_code
    })


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
