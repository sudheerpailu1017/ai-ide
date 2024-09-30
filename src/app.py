from flask import Flask, render_template
from api.fileOperations import file_ops
from api.executeCode import execute_code

app = Flask(__name__, static_folder='../public', template_folder='../templates')

# Register Blueprints
app.register_blueprint(file_ops, url_prefix='/file')
app.register_blueprint(execute_code)  # No url_prefix, so the route is available at /execute

@app.route('/')
def home():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
