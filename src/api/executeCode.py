from flask import Blueprint, request, jsonify
from services.pyExecutor import execute_python_code

execute_code = Blueprint('execute_code', __name__)

@execute_code.route('/execute', methods=['POST'])
def run_code():
    data = request.json
    code = data.get('code')

    try:
        output = execute_python_code(code)
        return jsonify({"output": output}), 200  # Return the output as JSON
    except Exception as e:
        return jsonify({"error": str(e)}), 500  # Return errors as JSON if any
