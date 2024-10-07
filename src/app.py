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

        # If the line ends with a colon (e.g., for loops, if statements)
        if trimmed_line.endswith(':'):
            formatted_code += ' ' * indent_level + trimmed_line + '\n'
            indent_level += indent_size
        elif trimmed_line.startswith(('return', 'elif', 'else')):
            # Reduce indentation for 'return', 'elif', and 'else'
            indent_level = max(0, indent_level - indent_size)
            formatted_code += ' ' * indent_level + trimmed_line + '\n'
        else:
            formatted_code += ' ' * indent_level + trimmed_line + '\n'

    return formatted_code

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
