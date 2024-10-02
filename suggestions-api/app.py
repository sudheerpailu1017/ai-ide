from flask import Flask
from flask_cors import CORS
from suggestions import code_suggestions  # Import the blueprint

app = Flask(__name__)
CORS(app)  # Enable CORS for the entire app

# Register the blueprint
app.register_blueprint(code_suggestions)

@app.route('/')
def home():
    return "Code Suggestion API is running"

if __name__ == '__main__':
    app.run(debug=True, port=5001)  # Run this app on port 5001
