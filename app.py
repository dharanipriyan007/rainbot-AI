from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
import os
import requests

app = FastAPI(title="Rainbot Backend")

# Enable CORS to allow direct local requests if running frontend via external server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = "AIzaSyAYTxij4MEkpb1OqB6SFfySAA8PUYSbiEc"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"

class ChatMessage(BaseModel):
    role: str  # "user" or "model"
    text: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage]

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    # Construct contents for Gemini API
    contents = []
    
    # Add chat history
    for msg in request.history:
        contents.append({
            "role": msg.role,
            "parts": [{"text": msg.text}]
        })
        
    # Add current user message
    contents.append({
        "role": "user",
        "parts": [{"text": request.message}]
    })

    # Prepare payload with system instructions
    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{
                "text": "You are Rainbot, a premium, intelligent, and highly engaging AI companion. "
                        "You speak with a professional yet friendly tone. Provide clear, well-structured "
                        "answers, using markdown for list items and code blocks (with appropriate language labels) "
                        "when writing code."
            }]
        },
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 2048,
        }
    }

    try:
        response = requests.post(GEMINI_API_URL, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        # Extract response text
        if "candidates" in data and len(data["candidates"]) > 0:
            candidate = data["candidates"][0]
            if "content" in candidate and "parts" in candidate["content"] and len(candidate["content"]["parts"]) > 0:
                bot_response = candidate["content"]["parts"][0]["text"]
                return {"response": bot_response}
        
        raise HTTPException(status_code=500, detail="Invalid response structure from Gemini API.")
        
    except requests.exceptions.RequestException as e:
        print(f"Error calling Gemini API: {e}")
        # Check if we have error details
        detail_msg = "Failed to communicate with AI backend."
        if e.response is not None:
            try:
                error_json = e.response.json()
                detail_msg = error_json.get("error", {}).get("message", detail_msg)
            except ValueError:
                detail_msg = e.response.text or detail_msg
        raise HTTPException(status_code=502, detail=detail_msg)

# Static file routing
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"), media_type="text/html")

@app.get("/script.js")
async def serve_script():
    return FileResponse(os.path.join(BASE_DIR, "script.js"), media_type="application/javascript")

@app.get("/style.css")
async def serve_style():
    return FileResponse(os.path.join(BASE_DIR, "style.css"), media_type="text/css")

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Rainbot backend is healthy and online"}