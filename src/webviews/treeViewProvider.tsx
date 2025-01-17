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

        this.setupMessageListener();

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
        // Create a prompt that will have cell indexes as well. 
        // const draftPrompt = `
        //     produce a summary of this jupyter notebook
        //     - don't include any information that is likely relevant to nearly all notebooks (data importing or loading)
        //     - keep in concise and not flowery,
        //     – begin with a TLDR 
        //     – change the tone to be that of an object content summary (ie not using terms like "in this notebook...,  the notebook explores....)
        //     - focus on action on the data (such as major decisions of the analysis)

        //     - for the most important phrases/decisions, include the relevant cell number(s) in this format {phrase}[cell number(s)]
        //     e.g. "the analysis uses a {"TF-IDF Vectorizor"}[cell 13] to convert the text data into a matrix of TF-IDF features"

        //     {notebook text}
        
        // `;

        return `Please provide a technical summary of this notebook that:

            Starts with a one-sentence overview
            Omits standard data loading/import steps 
            Uses direct, factual language focused on key analytical decisions and data transformations
            References critical steps with cell numbers in this format: {"key phrase"}[cell number(s)] where the cell numbers are comma separated
            Maintains an objective tone (avoid phrases like "this notebook explores...")
            Prioritizes describing concrete actions performed on the data

            Example format:
            "This notebook is an analysis of customer churn using gradient boosting.
            
            An {"initial exploratory analysis"}[cell 2,cell 3, cell 4] of the customer's {"spending patterns"}[cell 4] and corresponding segments. The data undergoes {"log transformation of numeric features"}[cell 8] followed by {"one-hot encoding of categorical variables"}[cell 9,10]. A {"random forest classifier"}[cell 15] identifies key predictive features, which inform feature selection for the final {"XGBoost model"}[cell 18]..."
            code: ${codeCells.map((cell, i) => `Block ${i + 1}:\n${cell.source.join('\n')}`).join('\n\n')}
        `



        // return `Analyze the following JSON of notebook cells and summarize them in a narrative in Narrative. Additionally, group them based on their functionality and/or structural patterns of analysis. Group should be the general pattern label, while subgroups label more specifically. Cell should specify the one or more cell numbers described by that subgroup.  
        
        // ${codeCells.map((cell, i) => `Block ${i + 1}:\n${cell.source.join('\n')}`).join('\n\n')}
        // `;
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
            // groups: z.array(Group),
            narrative: z.string(),
        });

        try {
            const openai = new OpenAI({ apiKey: "secret" });
            const response = await openai.beta.chat.completions.parse({
                model: 'gpt-4o-2024-08-06',
                messages: [
                    {
                        role: 'system',
                        content:
                            // 'You are an expert in structured data extraction. Summarize the provided notebook in one paragraph and convert the provided notebook JSON into structured groups and subgroups.',
                            'You are an expert in structured data extraction. Summarize the provided notebook according to the prompt and store it in Narrative.'
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

