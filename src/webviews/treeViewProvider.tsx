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
                this.processNotebook(editor);
            }
        });

        // initialization : when the extension in first opened
        const activeEditor = vscode.window.activeNotebookEditor;
        if (activeEditor) {
            this.processNotebook(activeEditor);
        }

        this.setupMessageListener();

        this.setupVariableListener();

        // setting the HTML content for the webview
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    // first present the variables   
    private async processNotebook(editor: vscode.NotebookEditor) {
        try {
            const notebookUri = editor.notebook.uri;
            const doc = await vscode.workspace.openTextDocument(notebookUri);
            const notebookData = doc.getText();
            const notebookJson = JSON.parse(notebookData);

            const codeCells = this.filterCodeCells(notebookJson);
            const variables = await this.detectPythonVariables(codeCells);

            // console.log('variables', variables)
            this.sendVariablesToWebview(variables);

            // const prompt = this.generatePrompt(variables, codeCells);
            // const structuredOutput = await this.getStructuredOutput(prompt);
            // const structuredOutput = {
            //     "groups": [
            //       {
            //         "name": "Data Preparation",
            //         "subgroups": [
            //           {
            //             "name": "Importing Libraries",
            //             "cells": [2]
            //           },
            //           {
            //             "name": "Loading Data",
            //             "cells": [1, 3]
            //           },
            //           {
            //             "name": "Data Exploration",
            //             "cells": [4, 5, 6, 7, 8, 9]
            //           }
            //         ]
            //       },
            //       {
            //         "name": "Text Vectorization and Feature Engineering",
            //         "subgroups": [
            //           {
            //             "name": "Manual Vectorization",
            //             "cells": [10]
            //           },
            //           {
            //             "name": "Count Vectorizer",
            //             "cells": [11, 12]
            //           },
            //           {
            //             "name": "TF-IDF Vectorizer",
            //             "cells": [13]
            //           }
            //         ]
            //       },
            //       {
            //         "name": "Model Training and Prediction",
            //         "subgroups": [
            //           {
            //             "name": "Train-Test Split",
            //             "cells": [14, 15]
            //           },
            //           {
            //             "name": "Model Training",
            //             "cells": [16]
            //           },
            //           {
            //             "name": "Prediction",
            //             "cells": [17]
            //           },
            //           {
            //             "name": "Evaluation Metrics",
            //             "cells": [18]
            //           }
            //         ]
            //       },
            //       {
            //         "name": "Visualization",
            //         "subgroups": [
            //           {
            //             "name": "Confusion Matrix",
            //             "cells": [19, 20, 21]
            //           },
            //           {
            //             "name": "Coefficient Visualization",
            //             "cells": [22, 23, 24]
            //           }
            //         ]
            //       },
            //       {
            //         "name": "Interpretability",
            //         "subgroups": [
            //           {
            //             "name": "Text Prediction Explanation",
            //             "cells": [25, 26, 27, 28]
            //           }
            //         ]
            //       },
            //       {
            //         "name": "Extended Analysis",
            //         "subgroups": [
            //           {
            //             "name": "Combined Categories Analysis",
            //             "cells": [29, 30, 31]
            //           },
            //           {
            //             "name": "Extended Train-Test Split",
            //             "cells": [32]
            //           },
            //           {
            //             "name": "Extended Model Training",
            //             "cells": [33]
            //           },
            //           {
            //             "name": "Extended Prediction",
            //             "cells": [34]
            //           },
            //           {
            //             "name": "Extended Evaluation Metrics",
            //             "cells": [35, 36, 37, 38]
            //           }
            //         ]
            //       }
            //     ]
            //   };

            // console.log('LLM response', structuredOutput)

            // this.sendTreeToWebview(structuredOutput);
        } catch (error) {
            console.error('Error processing notebook:', error);
            vscode.window.showErrorMessage('Failed to process notebook.');
        }
    }

    // aggregate method to get the LLM response for the notebook   
    private async processVariableTree(editor: any, variable: any) {
        try {
            const notebookUri = editor.notebook.uri;
            const doc = await vscode.workspace.openTextDocument(notebookUri);
            const notebookData = doc.getText();
            const notebookJson = JSON.parse(notebookData);
            const codeCells = this.filterCodeCells(notebookJson);

            const prompt = this.generateVariablePrompt(variable, codeCells);
            const structuredOutput = await this.getTreeOutput(prompt);

            console.log('LLM response', structuredOutput)

            this.sendTreeToWebview(structuredOutput);
        } catch (error) {
            console.error('Error processing notebook:', error);
            vscode.window.showErrorMessage('Failed to process notebook.');
        }
    }

    private setupVariableListener() {
        if (this._view) {
            this._view.webview.onDidReceiveMessage(async (message) => {
                console.log('message', message.type)
                switch (message.type) {
                    case 'selectVariable':
                        const editor = vscode.window.activeNotebookEditor;
                        this.processVariableTree(editor, message.name);
                }
            });
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
        return `Analyze the following JSON of notebook cells and group the actions conducted on the given variable in terms of patterns of analysis.  
        
        ${codeCells.map((cell, i) => `Block ${i + 1}:\n${cell.source.join('\n')}`).join('\n\n')}
        `;
    }

    private generateVariablePrompt(variable: any, codeCells: any[]) {
        return `Analyze the following JSON of notebook cells and group the actions conducted on the given variable name throughout the analysis.  
        
        Variable: ${variable}; 

        ${codeCells.map((cell, i) => `Block ${i + 1}:\n${cell.source.join('\n')}`).join('\n\n')}
        `;
    }

    private async getTreeOutput(prompt: string) {
        const Subgroup = z.object({
            name: z.string(),
            cells: z.array(z.number()),
        });

        const Group = z.object({
            name: z.string(),
            subgroups: z.array(Subgroup),
        });

        const NotebookSummarization = z.object({
            groups: z.array(Group)
        });

        try {
            const openai = new OpenAI({ apiKey: "key" });
            const response = await openai.beta.chat.completions.parse({
                model: 'gpt-4o-2024-08-06',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are an expert in structured data extraction. Convert the provided notebook JSON into structured groups and subgroups for the specified variable name.',
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

    private async handleCellSelection(event: vscode.NotebookEditorSelectionChangeEvent) {
      if (!this._view) return;
      
      const selectedCell = event.notebookEditor.notebook.cellAt(event.selections[0].start);
      
      // for code cells, get the execution order
      if (selectedCell.kind === vscode.NotebookCellKind.Code && 
          selectedCell.executionSummary?.executionOrder) {
          const executionCount = selectedCell.executionSummary.executionOrder;
          
          // Send message to webview to expand the corresponding tree node
          await this._view.webview.postMessage({
              type: 'expandNode',
              executionCount: executionCount
          });
      }
  }

  private async detectPythonVariables(codeCells: any) {
    // Regular expression to match variable assignments in Python (e.g., x = 10)
    const variableRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*.*$/;

    // Extract variable names from the source code
    const variables: Set<string> = new Set();

    codeCells.forEach((cell: any) => {
        cell.source.forEach((line: string) => {
            const match = line.trim().match(variableRegex);
            if (match) {
                variables.add(match[1]);  // Add the variable name to the set
            }
        });
    });

    // console.log('variables', Array.from(variables))

    return Array.from(variables); // Convert Set to Array
  }

  // takes selected cell from App 
    private setupMessageListener() {
        if (this._view) {
            this._view.webview.onDidReceiveMessage(async (message) => {
                console.log('message', message.type)
                switch (message.type) {
                    case 'selectCell':
                        const editor = vscode.window.activeNotebookEditor;
                        console.log
                        if (editor && message.index !== undefined) {

                          // based on index which includes markdown cells
                          // TODO: for this method, need to edit the notebook processing to retain the actual index rather than just 
                          //       execution output number -> check original json?
                          // console.log('message index', message.index)
                          //   // Get the cell at the specified index (0-based)
                          // const cell = editor.notebook.cellAt(message.index - 1);
                          
                          // // Reveal the cell in the editor
                          // editor.revealRange(
                          //     new vscode.NotebookRange(message.index - 1, message.index),
                          //     vscode.NotebookEditorRevealType.InCenter
                          // );
                          
                          // // Select the cell
                            // editor.selection = new vscode.NotebookRange(message.index - 1, message.index - 1);

                        // find by execution number from all original cells - def less efficient
                        const cells = editor.notebook.getCells();
                        let targetCellIndex = -1;
                        
                        for (let i = 0; i < cells.length; i++) {
                            const cell = cells[i];
                            // if code cell -> check matching execution count
                            if (cell.kind === vscode.NotebookCellKind.Code && 
                                cell.executionSummary?.executionOrder === message.index) {
                                targetCellIndex = i;
                                break;
                            }
                        }
                        
                        if (targetCellIndex !== -1) {
                            // scroll to the cell in the notebook 
                            editor.revealRange(
                                new vscode.NotebookRange(targetCellIndex, targetCellIndex + 1),
                                vscode.NotebookEditorRevealType.InCenter
                            );
                            
                            // Select the cell
                            editor.selection = new vscode.NotebookRange(
                                targetCellIndex,
                                targetCellIndex + 1
                            );
                          } else {
                            console.log('Could not find code cell with execution count:', message.index);
                        }
                        }
                        break;
                }
            });
        }
    }

    private sendVariablesToWebview(data: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'fetchVariables',
                data: data,
            });
        }
    }

    private sendTreeToWebview(data: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'fetchTree',
                data: data,
            });
        }
    }

    private sendNarrativeToWebview(data: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'fetchTree',
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

