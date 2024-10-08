from flask import Blueprint, jsonify, request

# Create a blueprint for the code suggestions API
code_suggestions = Blueprint('code_suggestions', __name__)

# Define some simple code suggestions based on patterns
code_suggestions_dict = {
    "def add(a,b):": [
        "    c = a + b",
        "    return c"
    ],
    "def subtract(a,b):": [
        "    return a - b"
    ],
    "for": [
        "for i in range(10):",
        "    print(i)"
    ]
}

@code_suggestions.route('/v2/chat/', methods=['POST'])
def chat():
    data = request.get_json()
    
    if data and 'message' in data:
        message = data['message']
        
        # Find a suggestion based on the input message
        suggestion = code_suggestions_dict.get(message.strip(), ["# No suggestion available"])

        # Return the suggestion as a response
        return jsonify({
            "response": "\n".join(suggestion)
        })
    else:
        return jsonify({"error": "Invalid request"}), 400
