# config.py
import os

class Config:
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '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')
    UPLOAD_FOLDER = './user_files'  # Directory to store files created by users
    ALLOWED_EXTENSIONS = {'py', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS
