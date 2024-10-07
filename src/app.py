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

# Updated Function to format Python code
def format_code(code):
    lines = code.split('\n')  # Split code into individual lines
    indent_level = 0
    indent_size = 4  # Default Python indentation size (4 spaces)
    formatted_code = ''
    
    for i, line in enumerate(lines):
        trimmed_line = line.strip()

        if trimmed_line == '':
            # Skip excessive empty lines (allow only one consecutive blank line)
            if i > 0 and lines[i - 1].strip() == '':
                continue
            formatted_code += '\n'
            continue

        # Apply indentation before appending the line
        if trimmed_line.startswith(('return', 'elif', 'else', 'except', 'finally', 'if')):
            formatted_code += ' ' * indent_level + trimmed_line + '\n'

        else:
            # Apply current indentation level to non-control flow lines
            formatted_code += ' ' * indent_level + trimmed_line + '\n'

        # Increase indentation for control flow structures
        if trimmed_line.endswith(':') and not trimmed_line.startswith(('return', 'elif', 'if', 'else', 'except', 'finally')):
            indent_level += indent_size

        # Handle dedentation for 'else', 'elif', 'finally', 'except', and 'return'
        if trimmed_line.startswith(('return', 'elif', 'else', 'except', 'finally')) and not trimmed_line.endswith(':'):
            indent_level = max(0, indent_level - indent_size)

    # Remove any excessive newlines at the end
    return formatted_code.rstrip() + '\n'


@app.route('/format_code', methods=['POST'])
def format_code_endpoint():
    # Get the code from the request
    data = request.get_json()
    code = data.get('code', '')

    if not code:
        return jsonify({'error': 'No code provided'}), 400

    # Format the code
    formatted_code = format_code(code)

    # Return the formatted code
    return jsonify({'formatted_code': formatted_code})

if __name__ == '__main__':
    app.run(debug=True)
