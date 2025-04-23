import * as vscode from 'vscode';
import { z } from 'zod';
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI({ apiKey: "key" });

export class TreeViewProvider implements vscode.WebviewViewProvider {

    // extension name
    public static readonly viewType = 'meng-notebook.treeView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {}

    // implementing the required method for extesions
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
            const groupedVars = await this.groupVariablesParse(codeCells, variables);

            // console.log('variables', variables)
            this.sendVariablesToWebview(groupedVars);
        } catch (error) {
            console.error('Error processing notebook:', error);
            vscode.window.showErrorMessage('Failed to process notebook.');
        }
    }

    // method that combines helper functions to get the LLM response for the notebook  
    // and sends it within the command 
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

    // process the textual summary
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

    // prompt generation for tree prompting
    private generateTreePrompt(codeCells: any[]) {
        return `Analyze the following JSON of notebook cells and group them based on their functionality and/or structural patterns of analysis. Group should be the general pattern label, while subgroups label more specifically. Cell should specify the execution number of the one or more cells described by that subgroup.  
        
        ${codeCells.map((cell, i) => `Block ${i + 1}:\n${cell.source.join('\n')}`).join('\n\n')}
        `;
    }

    // prompt generation for narrative prompting
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

    // LLM prompting for narrative
    private async getNarrativeOutput(prompt: string) {
        const narrative = z.object({
            text: z.string()
        });

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-2024-11-20',
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


    // LLM prompting for tree
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
            const response = await openai.beta.chat.completions.parse({
                model: 'gpt-4o-2024-11-20',
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

  private async handleArtifactSelection(event: vscode.NotebookEditorSelectionChangeEvent) {
    if (!this._view) return;
    
    const selectedCell = event.notebookEditor.notebook.cellAt(event.selections[0].start);
    
    // for code cells, get the execution order
    if (selectedCell.kind === vscode.NotebookCellKind.Code && 
        selectedCell.executionSummary?.executionOrder) {
        const executionCount = selectedCell.executionSummary.executionOrder;
        
        await this._view.webview.postMessage({
            type: 'selectArtifact',
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

  // return freq too 
  private async groupVariablesParse(codeCells: any, variables: string[]): Promise<{ cluster: string; variables: { name: string; frequency: number }[] }[]> {
    const functionClusters: Record<string, Map<string, number>> = {};
    const globalVariables: Map<string, number> = new Map();
    const clusterFrequency: Map<string, number> = new Map();

    const functionRegex = /\bdef\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*:/;
    const variableRegex = new RegExp(`\\b(${variables.join('|')})\\b`, 'g'); // Track only listed variables

    let currentFunction = "";

    codeCells.forEach((cell: any) => {
        cell.source.forEach((line: string) => {
            const functionMatch = line.match(functionRegex);

            if (functionMatch) {
                currentFunction = functionMatch[1]; // Set function context
                if (!functionClusters[currentFunction]) {
                    functionClusters[currentFunction] = new Map();
                }
            } else if (line.trim() === "") {
                currentFunction = ""; // Reset function context on empty line
            }

            // Capture occurrences of explicitly listed variables (ignore local assignments)
            const variableMatches = [...line.matchAll(variableRegex)];
            variableMatches.forEach(match => {
                const variable = match[1];
                if (currentFunction) {
                    functionClusters[currentFunction].set(variable, (functionClusters[currentFunction].get(variable) || 0) + 1);
                } else {
                    globalVariables.set(variable, (globalVariables.get(variable) || 0) + 1);
                }
            });
        });
    });

    // Compute frequency of explicitly listed variables per function
    for (const [func, vars] of Object.entries(functionClusters)) {
        const totalFrequency = Array.from(vars.values()).reduce((acc, count) => acc + count, 0);
        clusterFrequency.set(func, totalFrequency);
    }

    if (globalVariables.size > 0) {
        const totalFrequency = Array.from(globalVariables.values()).reduce((acc, count) => acc + count, 0);
        clusterFrequency.set("Global Variables", totalFrequency);
    }

    // Sort clusters by total variable usage
    const sortedClusters = Array.from(clusterFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => ({
            cluster: key,
            variables: key === "Global Variables"
                ? Array.from(globalVariables.entries()).sort((a, b) => b[1] - a[1]).map(([key, freq]) => ({ name: key, frequency: freq }))
                : Array.from(functionClusters[key].entries()).sort((a, b) => b[1] - a[1]).map(([key, freq]) => ({ name: key, frequency: freq }))
        }));

    return sortedClusters;
}


//   private async groupVariablesParse(codeCells: any, variables: string[]): Promise<{ cluster: string; variables: string[] }[]> {
//     const functionClusters: Record<string, Map<string, number>> = {};
//     const globalVariables: Map<string, number> = new Map();
//     const clusterFrequency: Map<string, number> = new Map();

//     const functionRegex = /\bdef\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*:/; 
//     const variableRegex = new RegExp(`\\b(${variables.join('|')})\\b`, 'g'); // Track only listed variables

//     let currentFunction = "";

//     codeCells.forEach((cell: any) => {
//         cell.source.forEach((line: string) => {
//             const functionMatch = line.match(functionRegex);

//             if (functionMatch) {
//                 currentFunction = functionMatch[1]; // Set function context
//                 if (!functionClusters[currentFunction]) {
//                     functionClusters[currentFunction] = new Map();
//                 }
//             } else if (line.trim() === "") {
//                 currentFunction = ""; // Reset function context on empty line
//             }

//             // Capture occurrences of explicitly listed variables (ignore local assignments)
//             const variableMatches = [...line.matchAll(variableRegex)];
//             variableMatches.forEach(match => {
//                 const variable = match[1];
//                 if (currentFunction) {
//                     functionClusters[currentFunction].set(variable, (functionClusters[currentFunction].get(variable) || 0) + 1);
//                 } else {
//                     globalVariables.set(variable, (globalVariables.get(variable) || 0) + 1);
//                 }
//             });
//         });
//     });

//     // Compute frequency of explicitly listed variables per function
//     for (const [func, vars] of Object.entries(functionClusters)) {
//         const totalFrequency = Array.from(vars.values()).reduce((acc, count) => acc + count, 0);
//         clusterFrequency.set(func, totalFrequency);
//     }

//     if (globalVariables.size > 0) {
//         const totalFrequency = Array.from(globalVariables.values()).reduce((acc, count) => acc + count, 0);
//         clusterFrequency.set("Global Variables", totalFrequency);
//     }

//     // Sort clusters by total variable usage
//     const sortedClusters = Array.from(clusterFrequency.entries())
//         .sort((a, b) => b[1] - a[1])
//         .map(([key]) => ({
//             cluster: key,
//             variables: key === "Global Variables"
//                 ? Array.from(globalVariables.entries()).sort((a, b) => b[1] - a[1]).map(([key]) => key)
//                 : Array.from(functionClusters[key].entries()).sort((a, b) => b[1] - a[1]).map(([key]) => key)
//         }));

//     return sortedClusters;
// }

// includes function params
//   private async groupVariablesParse(codeCells: any, variables: string[]): Promise<{ cluster: string; variables: string[] }[]> {
//     const functionClusters: Record<string, Map<string, number>> = {};
//     const globalVariables: Map<string, number> = new Map();
//     const clusterFrequency: Map<string, number> = new Map();
  
//     const functionRegex = /\bdef\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*:/; 
//     const variableRegex = new RegExp(`\\b(${variables.join('|')})\\b`, 'g');
  
//     let currentFunction = "";
  
//     codeCells.forEach((cell: any) => {
//       cell.source.forEach((line: string) => {
//         const functionMatch = line.match(functionRegex);
  
//         if (functionMatch) {
//           currentFunction = functionMatch[1];
//           const params = functionMatch[2]
//             .split(',')
//             .map(param => param.trim().split('=')[0].trim())
//             .filter(param => param !== "");
//           if (!functionClusters[currentFunction]) {
//             functionClusters[currentFunction] = new Map();
//           }
//           params.forEach(param => functionClusters[currentFunction].set(param, 1));
//         } else if (line.trim() === "") {
//           currentFunction = "";
//         }
  
//         const variableMatches = [...line.matchAll(variableRegex)];
//         variableMatches.forEach(match => {
//           const variable = match[1];
//           if (currentFunction) {
//             const cluster = functionClusters[currentFunction];
//             cluster.set(variable, (cluster.get(variable) || 0) + 1);
//           } else {
//             globalVariables.set(variable, (globalVariables.get(variable) || 0) + 1);
//           }
//         });
//       });
//     });
  
//     for (const [func, vars] of Object.entries(functionClusters)) {
//       const totalFrequency = Array.from(vars.values()).reduce((acc, count) => acc + count, 0);
//       clusterFrequency.set(func, totalFrequency);
//     }
  
//     if (globalVariables.size > 0) {
//       const totalFrequency = Array.from(globalVariables.values()).reduce((acc, count) => acc + count, 0);
//       clusterFrequency.set("Global Variables", totalFrequency);
//     }
  
//     // Sort clusters by total variable usage
//     const sortedClusters = Array.from(clusterFrequency.entries())
//       .sort((a, b) => b[1] - a[1])
//       .map(([key]) => ({
//         cluster: key,
//         variables: key === "Global Variables"
//           ? Array.from(globalVariables.entries()).sort((a, b) => b[1] - a[1]).map(([key]) => key)
//           : Array.from(functionClusters[key].entries()).sort((a, b) => b[1] - a[1]).map(([key]) => key)
//       }));
  
//     return sortedClusters;
//   }


  // FUNCTIONS AND GLOBAL VARS
//   private async groupVariablesParse(codeCells: any, variables: string[]): Promise<Record<string, string[]>> {
//     const functionClusters: Record<string, Set<string>> = {};
//     const globalVariables: Set<string> = new Set();
  
//     // Regex patterns
//     const functionRegex = /\bdef\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*:/; 
//     const variableRegex = new RegExp(`\\b(${variables.join('|')})\\b`, 'g');
  
//     let currentFunction = "";
  
//     codeCells.forEach((cell: any) => {
//       cell.source.forEach((line: string) => {
//         const functionMatch = line.match(functionRegex);
  
//         // If a function is detected, store the function name and parameters
//         if (functionMatch) {
//           currentFunction = functionMatch[1];
//           const params = functionMatch[2]
//             .split(',')
//             .map(param => param.trim().split('=')[0].trim()) // Remove default values
//             .filter(param => param !== "");
  
//           if (!functionClusters[currentFunction]) {
//             functionClusters[currentFunction] = new Set(params);
//           }
//         } else if (line.trim() === "") {
//           // Reset function context if an empty line (potential end of function) is detected
//           currentFunction = "";
//         }
  
//         // Find variables in the line
//         const variableMatches = [...line.matchAll(variableRegex)];
//         variableMatches.forEach(match => {
//           const variable = match[1];
//           if (currentFunction) {
//             functionClusters[currentFunction].add(variable);
//           } else {
//             globalVariables.add(variable);
//           }
//         });
//       });
//     });
  
//     // Convert to object for easy viewing
//     const clusters: Record<string, string[]> = {};
//     for (const [func, vars] of Object.entries(functionClusters)) {
//       clusters[func] = Array.from(vars);
//     }
    
//     // Add global variables as a separate cluster
//     if (globalVariables.size > 0) {
//       clusters["Global Variables"] = Array.from(globalVariables);
//     }
  
//     return clusters;
//   }
  

  // CO OCCURENCE 
//   private async groupVariablesParse(codeCells: any, variables: string[]): Promise<Record<string, string[]>> {
//     const variableUsage: Record<string, Set<string>> = {};
  
//     // Initialize variable tracking
//     variables.forEach((variable) => {
//       variableUsage[variable] = new Set();
//     });
  
//     // Regex patterns
//     const functionRegex = /\bdef\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*\)\s*:/; 
//     const variableRegex = new RegExp(`\\b(${variables.join('|')})\\b`, 'g');
  
//     let currentFunction = "";
  
//     // Analyze variable usage
//     codeCells.forEach((cell: any) => {
//       cell.source.forEach((line: string) => {
//         const functionMatch = line.match(functionRegex);
//         if (functionMatch) {
//           currentFunction = functionMatch[1]; 
//         }
  
//         const variableMatches = [...line.matchAll(variableRegex)];
//         const matchedVariables = variableMatches.map(match => match[1]);
  
//         // Track co-occurrence of variables
//         matchedVariables.forEach((var1) => {
//           matchedVariables.forEach((var2) => {
//             if (var1 !== var2) {
//               variableUsage[var1].add(var2);
//               variableUsage[var2].add(var1);
//             }
//           });
//         });
//       });
//     });
  
//     // Perform greedy clustering
//     const clusters: Record<string, string[]> = {};
//     const visited = new Set<string>();
  
//     let clusterIndex = 1;
  
//     function bfs(start: string) {
//       const queue = [start];
//       const cluster: string[] = [];
  
//       while (queue.length > 0) {
//         const variable = queue.shift()!;
//         if (!visited.has(variable)) {
//           visited.add(variable);
//           cluster.push(variable);
  
//           // Visit all connected variables
//           variableUsage[variable].forEach((neighbor) => {
//             if (!visited.has(neighbor)) {
//               queue.push(neighbor);
//             }
//           });
//         }
//       }
//       return cluster;
//     }
  
//     // Form clusters
//     for (const variable of variables) {
//       if (!visited.has(variable)) {
//         const newCluster = bfs(variable);
//         clusters[`Cluster ${clusterIndex}`] = newCluster;
//         clusterIndex++;
//       }
//     }
  
//     return clusters;
//   }
  

    cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length) {
            throw new Error("Vectors must be the same length");
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        if (normA === 0 || normB === 0) return 0; // Avoid division by zero

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private async groupVariablesByMeaning(variableNames: string[]): Promise<Record<string, string[]>> {
        if (variableNames.length === 0) return {};

        // Get embeddings for each variable name
        const embeddings = await Promise.all(variableNames.map(async (name) => {
            const response = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: name
            });
            return { name, embedding: response.data[0].embedding };
        }));

        // Clustering based on cosine similarity
        const groups: Record<string, string[]> = {};

        embeddings.forEach(({ name, embedding }) => {
            let assigned = false;
            for (const key in groups) {
                const sim = this.cosineSimilarity(embedding, embeddings.find(e => e.name === key)!.embedding)
                if (sim > 0.8) {
                    groups[key].push(name);
                    assigned = true;
                    break;
                }
            }
            if (!assigned) groups[name] = [name];
        });

        return groups;
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
                    case 'selectCell': {

                    }
                }
            });
        }
    }
    

    // when called, this function will represent the command 
    // to pass variable data under the command `fetchVariables`
    private sendVariablesToWebview(data: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'fetchVariables',
                data: data,
            });
        }
    }

    // when called, this function will represent the command 
    // to pass GPT tree data  under the command `fetchTree`
    private sendTreeToWebview(data: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'fetchTree',
                data: data,
            });
        }
    }

    // when called, this function will represent the command 
    // to pass GPT textual summary data  under the command `fetchTree`
    private sendNarrativeToWebview(data: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'fetchNarrative',
                data: data,
            });
        }
    }

    // when called, this function will represent the command 
    // to pass GPT textual summary data  under the command `fetchTree`
    private sendTextSelectionToWebview(data: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'fetchTextSelection',
                data: data,
            });
        }
    }

    // helper method to get HTML content for the webview, stays constant
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

