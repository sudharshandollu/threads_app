import * as vscode from 'vscode';
import axios from 'axios';

const API_URL = "http://localhost:8000";

export function activate(context: vscode.ExtensionContext) {

    const editCommand = vscode.commands.registerCommand('teamCopilot.edit', async () => {

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found");
            return;
        }

        const document = editor.document;
        const selection = editor.selection;

        // Ask user what they want to do
        const instruction = await vscode.window.showInputBox({
            prompt: "What do you want to do with this code?",
            placeHolder: "e.g., convert to async, optimize, add error handling"
        });

        if (!instruction) {
            vscode.window.showWarningMessage("No instruction provided");
            return;
        }

        const fileContent = document.getText();
        const cursorLine = document.lineAt(selection.active.line).text;

        try {

            vscode.window.showInformationMessage("Processing with AI...");

            const response = await axios.post(`${API_URL}/edit`, {
                user_id: "dev_user",
                file_path: document.fileName,
                language: document.languageId,
                content: fileContent,
                cursor_context: cursorLine,
                instruction: instruction
            });

            const updatedCode = response.data.updated_code;

            if (!updatedCode) {
                vscode.window.showErrorMessage("No response from AI");
                return;
            }

            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(fileContent.length)
            );

            await editor.edit(editBuilder => {
                editBuilder.replace(fullRange, updatedCode);
            });

            vscode.window.showInformationMessage("Code updated successfully");

        } catch (error: any) {

            console.error(error);

            vscode.window.showErrorMessage(
                "Error: " + (error?.response?.data?.detail || error.message)
            );
        }
    });

    context.subscriptions.push(editCommand);
}

export function deactivate() {}
