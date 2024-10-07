from flask import Flask, render_template, request, jsonify
from api.fileOperations import file_ops
from api.executeCode import execute_code

app = Flask(__name__, static_folder='../public', template_folder='../templates')

# Register Blueprints
app.register_blueprint(file_ops, url_prefix='/file')
app.register_blueprint(execute_code)  # No url_prefix, so the route is available at /execute

@app.route('/')
def home():
    return render_template('index.html')
# Function to format Python code
def format_code(code):
    lines = code.split('\n')  # Split code into individual lines
    indent_level = 0
    indent_size = 4  # Default Python indentation size (4 spaces)
    formatted_code = ''
    
    for line in lines:
        trimmed_line = line.strip()

        if trimmed_line == '':
            # Preserve empty lines
            formatted_code += '\n'
            continue

        # Apply the current indentation level to the line
        formatted_code += ' ' * indent_level + trimmed_line + '\n'

        # If the line ends with a colon (for loops, if statements, function definitions), increase indentation
        if trimmed_line.endswith(':'):
            indent_level += indent_size

        # Decrease indentation for 'return', 'elif', 'else', 'except', and 'finally'
        elif trimmed_line.startswith(('return', 'elif', 'else', 'except', 'finally')):
            indent_level = max(0, indent_level - indent_size)

    return formatted_code

@app.route('/format_code', methods=['POST'])
def format_code_endpoint():
    try:
        # Get the code from the request
        data = request.get_json()

        # Ensure the request has 'code' in the payload
        code = data.get('code', '')
        if not code:
            return jsonify({'error': 'No code provided'}), 400

        # Format the code using the provided function
        formatted_code = format_code(code)

        # Return the formatted code as JSON response
        return jsonify({'formatted_code': formatted_code}), 200

    except Exception as e:
        # If any unexpected error occurs, handle gracefully
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True)
