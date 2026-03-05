fastapi
uvicorn
python-dotenv
pydantic
openai




OPENAI_API_KEY=your_gpt5_key_here



import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL_NAME = "gpt-5"





from pydantic import BaseModel

class CodeCompletionRequest(BaseModel):
    user_id: str
    file_path: str
    language: str
    content: str
    cursor_context: str


class ChatRequest(BaseModel):
    user_id: str
    message: str
    context: str





from openai import OpenAI
from .config import OPENAI_API_KEY, MODEL_NAME

client = OpenAI(api_key=OPENAI_API_KEY)

def generate_completion(prompt: str):
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "You are a senior software engineer. Return only valid code. No explanations."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2
    )

    return response.choices[0].message.content


def generate_chat(prompt: str):
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "You are an expert coding assistant."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.5
    )

    return response.choices[0].message.content





from fastapi import APIRouter
from .schemas import CodeCompletionRequest, ChatRequest
from .llm_service import generate_completion, generate_chat

router = APIRouter()

@router.post("/complete")
def complete_code(request: CodeCompletionRequest):

    prompt = f"""
File Path: {request.file_path}
Language: {request.language}

Full File:
{request.content}

Cursor Context:
{request.cursor_context}

Complete the code at cursor position.
"""

    result = generate_completion(prompt)
    return {"completion": result}


@router.post("/chat")
def chat_with_code(request: ChatRequest):

    prompt = f"""
Code Context:
{request.context}

User Question:
{request.message}
"""

    result = generate_chat(prompt)
    return {"response": result}





from fastapi import FastAPI
from .routes import router

app = FastAPI()
app.include_router(router)






{
  "name": "team-copilot",
  "displayName": "Team Copilot",
  "version": "0.0.1",
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": ["onCommand:teamCopilot.complete", "onCommand:teamCopilot.chat"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "teamCopilot.complete",
        "title": "Team Copilot: Complete Code"
      },
      {
        "command": "teamCopilot.chat",
        "title": "Team Copilot: Ask About Code"
      }
    ]
  },
  "dependencies": {
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/vscode": "^1.85.0",
    "@types/node": "^20.0.0"
  }
}






import * as vscode from 'vscode';
import axios from 'axios';

const API_URL = "http://localhost:8000";

export function activate(context: vscode.ExtensionContext) {

    const completeCommand = vscode.commands.registerCommand('teamCopilot.complete', async () => {

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const selection = editor.selection;

        const fileContent = document.getText();
        const cursorLine = document.lineAt(selection.active.line).text;

        const response = await axios.post(`${API_URL}/complete`, {
            user_id: "dev_user",
            file_path: document.fileName,
            language: document.languageId,
            content: fileContent,
            cursor_context: cursorLine
        });

        editor.insertSnippet(new vscode.SnippetString(response.data.completion));
    });

    const chatCommand = vscode.commands.registerCommand('teamCopilot.chat', async () => {

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selectedText = editor.document.getText(editor.selection);

        const question = await vscode.window.showInputBox({
            prompt: "Ask about selected code"
        });

        if (!question) return;

        const response = await axios.post(`${API_URL}/chat`, {
            user_id: "dev_user",
            message: question,
            context: selectedText
        });

        vscode.window.showInformationMessage(response.data.response);
    });

    context.subscriptions.push(completeCommand);
    context.subscriptions.push(chatCommand);
}

export function deactivate() {}




