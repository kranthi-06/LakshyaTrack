from app.services.ai_service import ai_hub
import json
import re

async def generate_quiz(topic: str, difficulty: str, count: int):
    """
    Generates quiz questions using AI.
    """
    try:
        response = await ai_hub.generate_quiz_questions(topic, difficulty, count)
        
        # Clean up the response if it contains markdown code blocks
        clean_response = response.strip()
        if "```json" in clean_response:
            clean_response = clean_response.split("```json")[1].split("```")[0].strip()
        elif "```" in clean_response:
            clean_response = clean_response.split("```")[1].split("```")[0].strip()
            
        questions = json.loads(clean_response)
        
        # Validation
        valid_questions = []
        if isinstance(questions, list):
            for q in questions:
                # Basic schema validation
                if all(k in q for k in ["question", "options", "correct"]):
                    # Ensure options is a list of 4 strings (or close enough to be usable)
                    if isinstance(q["options"], list) and len(q["options"]) >= 2:
                        valid_questions.append(q)
        
        # Ensure ID alignment just in case
        for idx, q in enumerate(valid_questions):
            q["id"] = idx + 1
            
        return valid_questions
    except json.JSONDecodeError:
        raise RuntimeError("AI question generation is temporarily unavailable, please retry")
    except Exception as e:
        raise RuntimeError("AI question generation is temporarily unavailable, please retry") from e
