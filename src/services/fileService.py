# services/fileService.py
import os
from config import Config, allowed_file

def create_file(filename):
    filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
    if not allowed_file(filename):
        return {'error': 'Invalid file type.'}
    try:
        with open(filepath, 'w') as f:
            f.write('')  # Create an empty file
        return {'success': f'File {filename} created successfully.'}
    except Exception as e:
        return {'error': str(e)}

def read_file(filename):
    filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        return {'content': content}
    except FileNotFoundError:
        return {'error': 'File not found.'}
    except Exception as e:
        return {'error': str(e)}

def delete_file(filename):
    filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
    try:
        os.remove(filepath)
        return {'success': f'File {filename} deleted successfully.'}
    except FileNotFoundError:
        return {'error': 'File not found.'}
    except Exception as e:
        return {'error': str(e)}

def rename_file(old_name, new_name):
    old_path = os.path.join(Config.UPLOAD_FOLDER, old_name)
    new_path = os.path.join(Config.UPLOAD_FOLDER, new_name)
    try:
        os.rename(old_path, new_path)
        return {'success': f'File renamed from {old_name} to {new_name}.'}
    except Exception as e:
        return {'error': str(e)}
