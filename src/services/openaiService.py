# services/openaiService.py
import openai
from config import Config

openai.api_key = Config.OPENAI_API_KEY

def get_code_suggestion(code):
    try:
        response = openai.Completion.create(
            engine="text-davinci-003",
            prompt=code,
            max_tokens=150,
            temperature=0.5,
            n=1,
            stop=["\n"]
        )
        return response.choices[0].text
    except Exception as e:
        return {'error': str(e)}
