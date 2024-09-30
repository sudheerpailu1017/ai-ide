import subprocess

def execute_python_code(code):
    try:
        # Use subprocess to run Python code
        result = subprocess.run(
            ['python3', '-c', code],  # Pass the code to Python for execution
            capture_output=True,       # Capture stdout and stderr
            text=True,                 # Return output as a string
            timeout=5                  # Limit execution time to prevent long-running scripts
        )

        if result.returncode == 0:
            return result.stdout  # Return stdout on successful execution
        else:
            return result.stderr  # Return stderr if the code resulted in an error
    except subprocess.TimeoutExpired:
        return "Error: Code execution timed out."
    except Exception as e:
        return str(e)
