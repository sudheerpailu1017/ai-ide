from flask import Blueprint, request, jsonify
import os
from config import Config

file_ops = Blueprint('file_ops', __name__)

# Create a new file
@file_ops.route('/create', methods=['POST'])
def create_file():
    data = request.json
    filename = data.get('filename')
    filepath = os.path.join(Config.UPLOAD_FOLDER, filename)

    try:
        with open(filepath, 'w') as f:
            f.write('')  # Create an empty file
        return jsonify({"success": f"File {filename} created successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# List all files
@file_ops.route('/list', methods=['GET'])
def list_files():
    try:
        files = os.listdir(Config.UPLOAD_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Read a file
@file_ops.route('/read', methods=['GET'])
def read_file():
    filename = request.args.get('filename')
    filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
    
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        return jsonify({"content": content}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Save (update) a file
@file_ops.route('/save', methods=['POST'])
def save_file():
    data = request.json
    filename = data.get('filename')
    content = data.get('content')
    filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
    
    try:
        with open(filepath, 'w') as f:
            f.write(content)
        return jsonify({"success": f"File {filename} saved successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_ops.route('/delete', methods=['DELETE'])
def delete_file():
    data = request.json
    filename = data.get('filename')
    filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
    
    try:
        if os.path.exists(filepath):
            os.remove(filepath)  # Delete the file from the file system
            return jsonify({"success": f"File {filename} deleted successfully."}), 200
        else:
            return jsonify({"error": "File not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500