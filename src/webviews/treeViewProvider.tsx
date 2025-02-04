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
                this.processVariables(editor);
                console.log('Calling processTree...');
                this.processTree(editor);
            }
        });

        // initialization : when the extension in first opened
        const activeEditor = vscode.window.activeNotebookEditor;
        if (activeEditor) {
            this.processVariables(activeEditor);
            console.log('Calling processTree...');
            this.processTree(activeEditor);
        }

        this.setupMessageListener();
        this.setupVariableListener();

        // setting the HTML content for the webview
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    // first present the variables   
    private async processVariables(editor: vscode.NotebookEditor) {
        try {
            const notebookUri = editor.notebook.uri;
            const doc = await vscode.workspace.openTextDocument(notebookUri);
            const notebookData = doc.getText();
            const notebookJson = JSON.parse(notebookData);

            const codeCells = this.filterCodeCells(notebookJson);
            const variables = await this.detectPythonVariables(codeCells);

            // console.log('variables', variables)
            this.sendVariablesToWebview(variables);
        } catch (error) {
            console.error('Error processing notebook:', error);
            vscode.window.showErrorMessage('Failed to process notebook.');
        }
    }

    // aggregate method to get the LLM response for the notebook   
    private async processTree(editor: vscode.NotebookEditor) {
        try {
            console.log('beginning tree')
            const notebookUri = editor.notebook.uri;
            const doc = await vscode.workspace.openTextDocument(notebookUri);
            const notebookData = doc.getText();
            const notebookJson = JSON.parse(notebookData);
            const codeCells = this.filterCodeCells(notebookJson);

            const prompt = this.generateTreePrompt(codeCells);
            const structuredOutput = await this.getTreeOutput(prompt);

            console.log('LLM response', structuredOutput)

            this.sendTreeToWebview(structuredOutput);
        } catch (error) {
            console.error('Error processing notebook:', error);
            vscode.window.showErrorMessage('Failed to process tree.');
        }
    }

    // process  
    private async processVariableNarrative(editor: any, variable: any) {
        try {
            const notebookUri = editor.notebook.uri;
            const doc = await vscode.workspace.openTextDocument(notebookUri);
            const notebookData = doc.getText();
            const notebookJson = JSON.parse(notebookData);
            const codeCells = this.filterCodeCells(notebookJson);

            const prompt = this.generateNarrativePrompt(variable, codeCells);
            const structuredOutput = await this.getNarrativeOutput(prompt);

            console.log('LLM response', structuredOutput)

            this.sendNarrativeToWebview(structuredOutput);
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
                        this.processVariableNarrative(editor, message.name);
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

    // private generatePrompt(codeCells: any[]) {
    //     return `Analyze the following JSON of notebook cells and group the actions conducted on the given variable in terms of patterns of analysis.  
        
    //     ${codeCells.map((cell, i) => `Block ${i + 1}:\n${cell.source.join('\n')}`).join('\n\n')}
    //     `;
    // }

    private generateTreePrompt(codeCells: any[]) {
        return `Analyze the following JSON of notebook cells and group them based on their functionality and/or structural patterns of analysis. Group should be the general pattern label, while subgroups label more specifically. Cell should specify the execution number of the one or more cells described by that subgroup.  
        
        ${codeCells.map((cell, i) => `Block ${i + 1}:\n${cell.source.join('\n')}`).join('\n\n')}
        `;
    }

    private generateNarrativePrompt(variable: any, codeCells: any[]) {
        return `Please provide a technical summary of the given variable that:

        Starts with a one-sentence overview of actions performed on the variable 
        Uses direct, factual language focused on key analytical decisions
        References critical steps with cell numbers in this format: {"key phrase"}[cell execution number(s)] where the cell numbers are comma separated
        Maintains an objective tone (avoid phrases like "this notebook explores...")
        Prioritizes describing concrete actions performed on the variable
        The answer should be the summary itself, nothing else outputted.

        Here is an example output:
        
        "This variable is a dataframe describing customer churn rates.
        
        An {"initial exploratory analysis"}[cell 2,cell 3, cell 4] of the customer's {"spending patterns"}[cell 4] and corresponding segments. The data undergoes {"log transformation of numeric features"}[cell 8] followed by {"one-hot encoding of categorical variables"}[cell 9,10]. A {"random forest classifier"}[cell 15] identifies key predictive features, which inform feature selection for the final {"XGBoost model"}[cell 18]..."
        
        Do this for variable ${variable}.

        Here is the code: ${codeCells.map((cell, i) => `Block ${i + 1}:\n${cell.source.join('\n')}`).join('\n\n')}
    `
    }

    // LLM for narrative
    private async getNarrativeOutput(prompt: string) {
        const narrative = z.object({
            text: z.string()
        });

        try {
            const openai = new OpenAI({ apiKey: "key" });
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-2024-08-06',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are an expert in structured data extraction. Convert the provided notebook JSON into a narrative for the specified variable.',
                    },
                    { role: 'user', content: prompt },
                ],
            });
    
            return response.choices[0].message.content;
        } catch (error) {
            console.error('Error fetching OpenAI response:', error);
            throw error;
        }
    }


    // LLM for tree
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
                            `You are an expert in structured data extraction. Convert the provided notebook JSON into structured groups and subgroups. 
                             Cells is the cell execution number as it is in the JSON.`,
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
                command: 'fetchNarrative',
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

