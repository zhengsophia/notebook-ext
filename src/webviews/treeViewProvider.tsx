import * as vscode from 'vscode';
// import * as fs from 'fs';
// import * as path from 'path';
// import axios from 'axios'; // If needed for external API calls
import { z } from 'zod';
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
// import dotenv from "dotenv";

export class TreeViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'meng-notebook.treeView';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {}

    // Implementing the required method
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;


        // webview config
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri) 
            ]
        };

        // if any changes are made in the notebook editor
        vscode.window.onDidChangeActiveNotebookEditor((editor) => {
            if (editor) {
                this.processNotebookLLM(editor);
            }
        });

        // initialization : when the extension in first opened
        const activeEditor = vscode.window.activeNotebookEditor;
        if (activeEditor) {
            this.processNotebookLLM(activeEditor);
        }

        // setting the HTML content for the webview
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    // aggregate method to get the LLM response for the notebook   
    private async processNotebookLLM(editor: vscode.NotebookEditor) {
        try {
            const notebookUri = editor.notebook.uri;
            const doc = await vscode.workspace.openTextDocument(notebookUri);
            const notebookData = doc.getText();
            const notebookJson = JSON.parse(notebookData);

            const codeCells = this.filterCodeCells(notebookJson);
            const prompt = this.generatePrompt(codeCells);
            const structuredOutput = await this.getStructuredOutput(prompt);

            console.log('LLM response', structuredOutput)

            this.sendDataToWebview(structuredOutput);
        } catch (error) {
            console.error('Error processing notebook:', error);
            vscode.window.showErrorMessage('Failed to process notebook.');
        }
    }

    private filterCodeCells(notebook: any) {
        return notebook.cells
            .filter((cell: any) => cell.cell_type === 'code')
            .map((cell: any) => ({
                execution_count: cell.execution_count,
                outputs: cell.outputs,
                source: cell.source,
            }));
    }

    private generatePrompt(codeCells: any[]) {
        return `Analyze the following JSON of notebook cells and group them based on their functionality and/or structural patterns of analysis. Group should be the general pattern label, while subgroups label more specifically. Cell should specify the one or more cell numbers described by that subgroup.  

        ${codeCells.map((cell, i) => `Block ${i + 1}:\n${cell.source.join('\n')}`).join('\n\n')}
        `;
    }

    private async getStructuredOutput(prompt: string) {
        const Subgroup = z.object({
            name: z.string(),
            cells: z.array(z.number()),
        });

        const Group = z.object({
            name: z.string(),
            subgroups: z.array(Subgroup),
        });

        const NotebookSummarization = z.object({
            groups: z.array(Group),
        });

        try {
            const openai = new OpenAI({ apiKey: "replace-with-your-key" });
            const response = await openai.beta.chat.completions.parse({
                model: 'gpt-4o-2024-08-06',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are an expert in structured data extraction. Convert the provided notebook JSON into structured groups and subgroups.',
                    },
                    { role: 'user', content: prompt },
                ],
                response_format: zodResponseFormat(
                    NotebookSummarization,
                    'notebook_summarization'
                ),
            });

            return response.choices[0].message.parsed;
        } catch (error) {
            console.error('Error fetching OpenAI response:', error);
            throw error;
        }
    }

    private sendDataToWebview(data: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'fetchNotebookData',
                data: data,
            });
        }
    }

    // helper method to get HTML content for the webview
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist/webviews', 'App.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist/webviews', 'App.css'));

        console.log('script URI', scriptUri);
        console.log('style URI', styleUri);

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="${styleUri}">
                <title>Tree View</title>
            </head>
            <body>
                <div id="app">Tree View Content</div>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}

