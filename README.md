{
  "name": "team-copilot",
  "displayName": "Team Copilot",
  "version": "0.0.1",
  "engines": { "vscode": "^1.85.0" },

  "activationEvents": [
    "onStartupFinished"
  ],

  "main": "./out/extension.js",

  "contributes": {
    "inlineCompletions": [
      {
        "language": "*"
      }
    ]
  },

  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
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

    const provider: vscode.InlineCompletionItemProvider = {

        async provideInlineCompletionItems(document, position) {

            const textBeforeCursor = document.getText(
                new vscode.Range(
                    new vscode.Position(Math.max(position.line - 50, 0), 0),
                    position
                )
            );

            try {

                const response = await axios.post(`${API_URL}/complete`, {
                    user_id: "dev_user",
                    file_path: document.fileName,
                    language: document.languageId,
                    content: textBeforeCursor,
                    cursor_context: textBeforeCursor
                });

                const suggestion = response.data.completion;

                return {
                    items: [
                        {
                            insertText: suggestion
                        }
                    ]
                };

            } catch (err) {

                console.error(err);

                return { items: [] };

            }
        }
    };

    const disposable = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: "**" },
        provider
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}





