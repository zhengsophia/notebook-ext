import * as vscode from 'vscode';
import { z } from 'zod';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

const openai = new OpenAI({
  apiKey: '',
});

export class TreeViewProvider implements vscode.WebviewViewProvider {
  // extension name
  public static readonly viewType = 'meng-notebook.treeView';
  private _view?: vscode.WebviewView;
  private variableSummaryCache = new Map<string, string>();
  private treeCache: any;
  private _suppressNextRevealCount = 0;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  // registers the variable to be added from hover tooltip selection via command
  public registerHover(context: vscode.ExtensionContext) {
    // modifying the hover tooltip content
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        { scheme: 'vscode-notebook-cell', language: 'python' },
        {
          provideHover: (document, position) => {
            const range = document.getWordRangeAtPosition(position);
            if (!range) return;
            const word = document.getText(range);
            const markdown = new vscode.MarkdownString(
              `[🤓 Summarize the variable "${word}"](command:treeview.processVariableSummary?${encodeURIComponent(JSON.stringify(word))})\n\n`
              // + `[📌 Pin the variable "${word}"](command:treeview.addVariable?${encodeURIComponent(JSON.stringify(word))})`
            );
            markdown.isTrusted = true;
            return new vscode.Hover(markdown, range);
          },
        }
      )
    );

    // trying to filter for just [variable, function]
    // context.subscriptions.push(
    //   vscode.languages.registerHoverProvider(
    //     { scheme: 'vscode-notebook-cell', language: 'python' },
    //     {
    //       async provideHover(document, position) {
    //         const range = document.getWordRangeAtPosition(position);
    //         if (!range) return;
    //         const word = document.getText(range);
    //         const lineText = document.lineAt(position.line).text;

    //         // 1) Try the built-in symbol provider first:
    //         const symbols = await vscode.commands.executeCommand<
    //           vscode.DocumentSymbol[]
    //         >('vscode.executeDocumentSymbolProvider', document.uri);
    //         const flatten = (
    //           syms: vscode.DocumentSymbol[]
    //         ): vscode.DocumentSymbol[] =>
    //           syms.flatMap((sym) => [sym, ...flatten(sym.children)]);
    //         const allSyms = symbols ? flatten(symbols) : [];
    //         const symAtPos = allSyms.find((sym) =>
    //           sym.selectionRange.contains(position)
    //         );

    //         let isKnownDef = false;
    //         if (symAtPos) {
    //           // only allow real vars or funcs
    //           if (
    //             symAtPos.kind === vscode.SymbolKind.Variable ||
    //             symAtPos.kind === vscode.SymbolKind.Function
    //           ) {
    //             isKnownDef = true;
    //           }
    //         }

    //         // 2) Now build a set of **all** assignments+defs in this cell
    //         const text = document.getText();
    //         const assignRe = /^\s*([A-Za-z_]\w*)\s*=/gm;
    //         const defRe = /^\s*def\s+([A-Za-z_]\w*)\s*\(/gm;
    //         const names = new Set<string>();
    //         let m: RegExpExecArray | null;
    //         while ((m = assignRe.exec(text))) names.add(m[1]);
    //         while ((m = defRe.exec(text))) names.add(m[1]);

    //         // 3) If it's neither a semantic symbol nor in our name-set, bail
    //         if (!isKnownDef && !names.has(word)) {
    //           return;
    //         }

    //         // 4) Otherwise show your hover link on **any** occurrence of that name:
    //         const md = new vscode.MarkdownString(
    //           `[🤓 Summarize “${word}”](command:treeview.processVariableSummary?${encodeURIComponent(
    //             JSON.stringify(word)
    //           )})`
    //         );
    //         md.isTrusted = true;
    //         return new vscode.Hover(md, range);
    //       },
    //     }
    //   )
    // );

    // COMMAND - add variable to the variables pane
    // context.subscriptions.push(
    //   vscode.commands.registerCommand(
    //     'treeview.addVariable',
    //     (variable: string) => {
    //       this.handleHoveredVariableSelection(variable);
    //     }
    //   )
    // );

    // testing cell -> tree directionality
    context.subscriptions.push(
      vscode.window.onDidChangeNotebookEditorSelection((e) => {
        if (this._suppressNextRevealCount > 0) {
          this._suppressNextRevealCount--;
          return;
        }
        const idx = e.selections[0]?.start;
        console.log('expandNode idx', idx);
        if (idx !== undefined && this._view) {
          this._view.webview.postMessage({
            type: 'expandNode',
            index: idx,
          });
        }
      })
    );

    // // COMMAND - present in line text summary
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'treeview.processVariableSummary',
        (word: string) => {
          const editor = vscode.window.activeNotebookEditor;
          if (editor) {
            console.log('processing narrative for:', word);
            this.handleHoveredVariableSelection(word);
          }
        }
      )
    );
  }

  // implementing the required method for extensions
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    // webview config
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri)],
    };

    /* ENTRY POINT: activate on opening initialization */
    // if any changes are made in the notebook editor
    vscode.window.onDidChangeActiveNotebookEditor((editor) => {
      if (editor) {
        this.processVariables(editor);
        console.log('Calling processTree...');
        this.processTree(editor);
      }
    });

    // for some reason I don't need this one?
    // I thought this took it on initialization but it doesn't
    // const activeEditor = vscode.window.activeNotebookEditor;
    // if (activeEditor) {
    //   this.processVariables(activeEditor);
    //   console.log('Calling processTree...');
    //   this.processTree(activeEditor);
    // }

    // add the variable when clicked -> EXTRACTED TO WHEN THE USER WANTS TO ADD ON HOVER
    // vscode.window.onDidChangeTextEditorSelection((e) => {
    //   //   console.log('testing!!', e.textEditor.document.languageId);
    //   //   if (e.textEditor.document.languageId === 'notebook') {
    //   // make sure it's notebook editor
    //   const word = this.getClickedArtifact(
    //     e.textEditor,
    //     e.selections[0].active
    //   );
    //   if (word) {
    //     console.log('got word', word);
    //     this.handleHoveredVariableSelection(word);
    //     const editor = vscode.window.activeNotebookEditor;
    //     this.processVariableSummary(editor, word);
    //   }
    //   //   }
    // });

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
      // const groupedVars = await this.groupVariablesParse(codeCells, variables);
      console.log('sending variables', variables);
      this.sendVariablesToWebview(variables);
    } catch (error) {
      console.error('Error processing notebook:', error);
      vscode.window.showErrorMessage('Failed to process notebook.');
    }
  }

  // method that combines helper functions to get the LLM response for the notebook and sends it within the command
  private async processTree(editor: vscode.NotebookEditor) {
    try {
      console.log('beginning tree');
      const notebookUri = editor.notebook.uri;
      const doc = await vscode.workspace.openTextDocument(notebookUri);
      const notebookData = doc.getText();
      const notebookJson = JSON.parse(notebookData);
      const codeCells = this.filterCodeCells(notebookJson);

      const prompt = this.generateTreePrompt(codeCells);
      const structuredOutput = await this.getTreeOutput(prompt);

      console.log('LLM response for making tree', structuredOutput);
      if (structuredOutput) {
        this.treeCache = structuredOutput;
      }
      this.sendTreeToWebview(structuredOutput);
    } catch (error) {
      console.error('Error processing notebook:', error);
      vscode.window.showErrorMessage('Failed to process tree.');
    }
  }

  // process the textual summary
  private async processVariableSummary(editor: any, variable: any) {
    try {
      const notebookUri = editor.notebook.uri;
      const doc = await vscode.workspace.openTextDocument(notebookUri);
      const notebookData = doc.getText();
      const notebookJson = JSON.parse(notebookData);
      const codeCells = this.filterCodeCells(notebookJson);

      const prompt = this.generateNarrativePrompt(variable, codeCells);
      const structuredOutput = await this.getNarrativeOutput(prompt);
      console.log('LLM response for in line textual summary', structuredOutput);
      if (structuredOutput) {
        this.variableSummaryCache.set(variable, structuredOutput);
        console.log('variableSummaryCache', this.variableSummaryCache);
      }
      this.sendNarrativeToWebview(structuredOutput);
    } catch (error) {
      console.error('Error processing notebook:', error);
      vscode.window.showErrorMessage('Failed to process notebook.');
    }
  }

  private setupVariableListener() {
    if (this._view) {
      this._view.webview.onDidReceiveMessage(async (message) => {
        console.log('message', message.type);
        switch (message.type) {
          case 'getVariableSummary':
            const editor = vscode.window.activeNotebookEditor;
            const variable = message.name;
            // checking cache
            if (this.variableSummaryCache.has(variable)) {
              const cachedNarrative = this.variableSummaryCache.get(variable)!;
              console.log('cached', cachedNarrative);
              // send in line textual summaries to tree
              this.sendNarrativeToWebview(cachedNarrative);
            } else {
              console.log('not cached :(');
              this.processVariableSummary(editor, variable);
            }
            break;
          case 'clearTree':
            // re-send just the tree (no narrativeMapping)
            console.log('reached webview clearing tree', this.treeCache);
            this.sendTreeToWebview(this.treeCache);
            break;
        }
      });
    }
  }

  private filterCodeCells(notebook: any) {
    const codeCells = notebook.cells
      .map((cell: any, origIdx: number) => ({ cell, origIdx }))
      .filter(
        ({ cell, origIdx }: { cell: any; origIdx: number }) =>
          cell.cell_type === 'code'
      )
      .map(({ cell, origIdx }: { cell: any; origIdx: number }) => ({
        id: origIdx,
        outputs: cell.outputs,
        source: cell.source,
      }));
    console.log('codeCells', codeCells);
    return codeCells;
  }

  // vscode api to get the word that was clicked in notebook editor
  // DEPRECATED -> moved to adding via button on hover tooltip
  // private getClickedArtifact(
  //   editor: vscode.TextEditor,
  //   position: vscode.Position
  // ): string | null {
  //   const wordRange = editor.document.getWordRangeAtPosition(position);
  //   if (wordRange) {
  //     return editor.document.getText(wordRange);
  //   }
  //   return null;
  // }

  // prompt generation for tree prompting
  private generateTreePrompt(codeCells: any[]) {
    // return `Analyze the following JSON of notebook cells and group them based on their functionality and/or structural patterns of analysis.
    //         Narrative is a one-sentence overview of the notebook purpose.
    //         Group should be the general pattern label, while subgroups label more specifically.
    //         Use as much context from the notebook topic as possible in labelings.
    //         Cell should specify the execution number of the one or more cells described by that subgroup.
    //         Each cell number should only appear once in the most relevant subgroup.
    //         All cell numbers must be included.

    //     ${codeCells.map((cell, i) => `Block ${i + 1}:\n${cell.source.join('\n')}`).join('\n\n')}
    //     `;
    const prompt = `You're given a JSON array of notebook code cells. Produce a JSON output with this structure:

                    {
                      narrative: string,          // one-sentence summary of the notebook's overall purpose
                      groups: [
                        {
                          name: string,           // broad functional “group” label
                          subgroups: [
                            {
                              name: string,       // more specific “subgroup” label
                              cells: number[]     // array of cell ids
                            }
                          ]
                        }
                      ]
                    }

                    Rules:
                    1. Use as much context as possible in the code to name each group and subgroup.
                    2. **Every single cell id number must appear exactly once** in one and only one subgroup's \`cells\` array.
                      - Do not omit any cell id.
                      - **Every id number from 0 to ${codeCells.length - 1}**, inclusive must be included in the output.
                      - No cell ID may be skipped, missing, duplicated, or invented.
                      - Do not repeat a cell number in more than one place.
                    3. The order of cells in each subgroup can be ascending or based on logical flow.

                    Here is the input JSON. Label the cells by their \`id\`:
                    ${codeCells
                      .map(
                        (cell, i) =>
                          `Block ${cell.id}:\n${cell.source.join('\n')}`
                      )
                      .join('\n\n')}
                    `;
    return prompt;
  }

  // prompt generation for narrative prompting
  private generateNarrativePrompt(variable: any, codeCells: any[]) {
    // return `Provide a technical summary of the given variable that:

    //     Starts with a one-sentence overview of actions performed on the variable.

    //     In the following sentences:
    //     Keeps each sentence concise and short.
    //     Uses direct, factual language focused on key analytical decisions.
    //     Maintains an objective tone (avoid phrases like "this notebook explores...").
    //     Prioritizes describing concrete actions performed on the variable.
    //     Annotates important phrases in the sentence in the format {"phrase"}[cell 1].
    //     Each annotation must start with 'cell ' and only include one cell determined by the first cell that functionality occurs.
    //     Split sentence so that one sentence only describes one cell.

    //     The answer should be the summary itself, nothing else outputted.

    //     Here is an example output:

    //     "This variable is a dataframe describing customer churn rates.

    //     An {"initial exploratory analysis"}[cell 2] of the customer's spending patterns and corresponding segments. The data undergoes {"log transformation of numeric features"}[cell 8]. This is followed by {"one-hot encoding of categorical variables"}[cell 9]. A {"random forest classifier"}[cell 15] identifies key predictive features. These inform feature selection for the final {"XGBoost model"}[cell 18]..."

    //     Do this for variable ${variable}.

    //     Here is the code: ${codeCells.map((cell, i) => `Block ${i + 1}:\n${cell.source.join('\n')}`).join('\n\n')}
    // `;
    const prompt = `You are an expert at writing concise, factual variable summaries.

                    **Output**
                    Return **only** the summary as plain text, with one sentence per line. Do **not** include any explanations, bullet points, or extra commentary.

                    **Structure**
                    1. **Overview (1 sentence):** A short, high-level statement of what happens to \`${variable}\`.
                    2. **Details:**
                      - Each sentence must describe discrete action or functionality on \`${variable}\`.
                      - Annotate exactly one cell per sentence using the syntax:
                        \`{"<phrase>"}[cell N]\` with the most important cell in that sentence where N is the associated cell id. 
                      - Use the **first** relevant cell id number if multiple apply.
                      - Keep sentences concise and strictly factual (no “this notebook explores…”).
                      - Uuse contractions like "It's" instead of "It is".

                    **Example**
                    This variable is a dataframe describing customer churn rates.
                    An {"initial exploratory analysis"}[cell 2] of the customer's spending patterns and corresponding segments.
                    The data undergoes {"log transformation of numeric features"}[cell 8].
                    This is followed by {"one-hot encoding of categorical variables"}[cell 9].
                    A {"random forest classifier"}[cell 15] identifies key predictive features.
                    These inform feature selection for the final {"XGBoost model"}[cell 18].

                    **Write the summary for variable** \`${variable}\`:

                    Notebook code:
                    ${codeCells
                      .map(
                        (cell, i) =>
                          `Block ${cell.id}:\n${cell.source.join('\n')}`
                      )
                      .join('\n\n')}
                    `;
    return prompt;
  }

  // LLM prompting for narrative
  private async getNarrativeOutput(prompt: string) {
    const narrative = z.object({
      text: z.string(),
    });

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-2024-11-20',
        // model: 'o4-mini-2025-04-16',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert in structured data extraction. Summarize the specified variable in the provided notebook JSON.',
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
      narrative: z.string(),
      groups: z.array(Group),
    });

    try {
      const response = await openai.beta.chat.completions.parse({
        model: 'gpt-4o-2024-11-20',
        // model: 'o4-mini-2025-04-16',
        messages: [
          {
            role: 'system',
            content: `You are an expert in structured data extraction. Convert the provided notebook JSON into structured groups and subgroups. 
                             Cells is the cell id number as it is in the JSON.`,
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

  // get specific variable clicked from notebook editor to send to the webview
  private async handleHoveredVariableSelection(variable: string) {
    if (!this._view) return;

    this._view.webview.postMessage({
      type: 'sendHoveredVariable',
      name: variable,
    });
  }

  private stripStrings(line: string): string {
    return line.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '');
  }

  private async detectPythonVariables(
    codeCells: any
  ): Promise<{ name: string; frequency: number }[]> {
    // Only match assignments at zero indent: `var = …`
    const assignRe = /^([A-Za-z_]\w*)\s*=/;
    // Only match function defs at zero indent: `def foo(...):`
    const defRe = /^def\s+([A-Za-z_]\w*)\s*\(/;

    const freqMap: Map<string, number> = new Map();

    // 1st pass: grab all variables or functions declared at the top-most level
    const names = new Set<string>();
    codeCells.forEach((cell: any) =>
      cell.source.forEach((rawLine: string) => {
        const indent = rawLine.match(/^[ \t]*/)![0].length;
        if (indent > 1) return; // still only top‐level
        const line = rawLine.trim();
        let m = assignRe.exec(line) || defRe.exec(line);
        if (m) names.add(m[1]);
      })
    );

    names.forEach((n) => freqMap.set(n, 0));

    // 2nd pass: count occurrences for frequency
    codeCells.forEach((cell: any) =>
      cell.source.forEach((rawLine: string) => {
        // strip strings first
        const noStrings = rawLine.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '');

        names.forEach((name) => {
          const line = noStrings.trim();

          // skip if it's the declaration
          if (
            new RegExp(`^${name}\\s*=`).test(line) ||
            new RegExp(`^def\\s+${name}\\s*\\(`).test(line)
          ) {
            return;
          }

          // count every other occurence -> not the most robust but it's ok
          const usageRe = new RegExp(`\\b${name}\\b`, 'g');
          const matches = noStrings.match(usageRe);
          if (matches) {
            freqMap.set(name, freqMap.get(name)! + matches.length);
          }
        });
      })
    );

    // descending frequency
    return Array.from(freqMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name, frequency]) => ({ name, frequency }));
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
  // to pass GPT textual summary data under the command `fetchTree`
  private sendNarrativeToWebview(data: any) {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'fetchNarrative',
        data: data,
      });
    }
  }

  // takes selected cell from App
  private setupMessageListener() {
    if (this._view) {
      this._view.webview.onDidReceiveMessage(async (message) => {
        console.log('message', message.type);
        switch (message.type) {
          case 'selectCell': {
            this._suppressNextRevealCount = 2;
            const idx = message.index as number;
            const editor = vscode.window.activeNotebookEditor;
            if (!editor) break;
            // directly reveal the cell at that index
            editor.revealRange(
              new vscode.NotebookRange(idx, idx + 1),
              vscode.NotebookEditorRevealType.InCenter
            );
            editor.selection = new vscode.NotebookRange(idx, idx + 1);
            break;
          }
        }
      });
    }
  }

  // helper method to get HTML content for the webview, stays constant
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist/webviews', 'App.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist/webviews', 'App.css')
    );

    console.log('script URI', scriptUri);
    console.log('style URI', styleUri);

    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link 
                  href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap" 
                  rel="stylesheet"
                >
                  <link rel="stylesheet" href="https://use.typekit.net/yai8rmw.css">
                <link rel="stylesheet" href="${styleUri}">
                <title>Tree View</title>
            </head>
            <body>
                <div id="app"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
  }
}

// code purgatory lolz
// // return freq too
// private async groupVariablesParse(
//   codeCells: any,
//   variables: string[]
// ): Promise<
//   { cluster: string; variables: { name: string; frequency: number }[] }[]
// > {
//   const functionClusters: Record<string, Map<string, number>> = {};
//   const globalVariables: Map<string, number> = new Map();
//   const clusterFrequency: Map<string, number> = new Map();

//   const functionRegex = /\bdef\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*:/;
//   const variableRegex = new RegExp(`\\b(${variables.join('|')})\\b`, 'g'); // Track only listed variables

//   let currentFunction = '';

//   codeCells.forEach((cell: any) => {
//     cell.source.forEach((line: string) => {
//       const functionMatch = line.match(functionRegex);

//       if (functionMatch) {
//         currentFunction = functionMatch[1]; // Set function context
//         if (!functionClusters[currentFunction]) {
//           functionClusters[currentFunction] = new Map();
//         }
//       } else if (line.trim() === '') {
//         currentFunction = ''; // Reset function context on empty line
//       }

//       // Capture occurrences of explicitly listed variables (ignore local assignments)
//       const variableMatches = [...line.matchAll(variableRegex)];
//       variableMatches.forEach((match) => {
//         const variable = match[1];
//         if (currentFunction) {
//           functionClusters[currentFunction].set(
//             variable,
//             (functionClusters[currentFunction].get(variable) || 0) + 1
//           );
//         } else {
//           globalVariables.set(
//             variable,
//             (globalVariables.get(variable) || 0) + 1
//           );
//         }
//       });
//     });
//   });

//   // Compute frequency of explicitly listed variables per function
//   for (const [func, vars] of Object.entries(functionClusters)) {
//     const totalFrequency = Array.from(vars.values()).reduce(
//       (acc, count) => acc + count,
//       0
//     );
//     clusterFrequency.set(func, totalFrequency);
//   }

//   if (globalVariables.size > 0) {
//     const totalFrequency = Array.from(globalVariables.values()).reduce(
//       (acc, count) => acc + count,
//       0
//     );
//     clusterFrequency.set('Global Variables', totalFrequency);
//   }

//   // Sort clusters by total variable usage
//   const sortedClusters = Array.from(clusterFrequency.entries())
//     .sort((a, b) => b[1] - a[1])
//     .map(([key]) => ({
//       cluster: key,
//       variables:
//         key === 'Global Variables'
//           ? Array.from(globalVariables.entries())
//               .sort((a, b) => b[1] - a[1])
//               .map(([key, freq]) => ({ name: key, frequency: freq }))
//           : Array.from(functionClusters[key].entries())
//               .sort((a, b) => b[1] - a[1])
//               .map(([key, freq]) => ({ name: key, frequency: freq })),
//     }));

//   return sortedClusters;
// }

// diff grouping methods
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

// CO OCCURENCE GROUPING CODE
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

// GROUPING CODE
//   cosineSimilarity(vecA: number[], vecB: number[]): number {
//     if (vecA.length !== vecB.length) {
//       throw new Error('Vectors must be the same length');
//     }

//     let dotProduct = 0;
//     let normA = 0;
//     let normB = 0;

//     for (let i = 0; i < vecA.length; i++) {
//       dotProduct += vecA[i] * vecB[i];
//       normA += vecA[i] * vecA[i];
//       normB += vecB[i] * vecB[i];
//     }

//     if (normA === 0 || normB === 0) return 0; // Avoid division by zero

//     return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
//   }

//   private async groupVariablesByMeaning(
//     variableNames: string[]
//   ): Promise<Record<string, string[]>> {
//     if (variableNames.length === 0) return {};

//     // Get embeddings for each variable name
//     const embeddings = await Promise.all(
//       variableNames.map(async (name) => {
//         const response = await openai.embeddings.create({
//           model: 'text-embedding-ada-002',
//           input: name,
//         });
//         return { name, embedding: response.data[0].embedding };
//       })
//     );

//     // Clustering based on cosine similarity
//     const groups: Record<string, string[]> = {};

//     embeddings.forEach(({ name, embedding }) => {
//       let assigned = false;
//       for (const key in groups) {
//         const sim = this.cosineSimilarity(
//           embedding,
//           embeddings.find((e) => e.name === key)!.embedding
//         );
//         if (sim > 0.8) {
//           groups[key].push(name);
//           assigned = true;
//           break;
//         }
//       }
//       if (!assigned) groups[name] = [name];
//     });

//     return groups;
//   }
