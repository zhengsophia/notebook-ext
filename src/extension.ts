// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TreeViewProvider } from "./webviews/treeViewProvider";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "notebook-ext" is now active!');

    // ~~~~~~~ Register the TreeViewProvider ~~~~~~~~
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            TreeViewProvider.viewType,
            new TreeViewProvider(context.extensionUri)
        )
    );

    // ~~~~~ backend server functionality ~~~~~~~
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('notebook-ext.getNotebookData', async () => {
		// The code you place here will be executed every time your command is executed
        const editor = vscode.window.activeNotebookEditor;

		console.log('editor info', editor);

        if (editor) {
            try {
                const notebookUri = editor.notebook.uri;
                const doc = await vscode.workspace.openTextDocument(notebookUri);
                const notebookData = doc.getText();
                console.log('notebookData:', notebookData);
                const notebookJson = JSON.parse(notebookData);
                console.log('notebookJson:', notebookJson);
            } catch (error) {
                console.error('Error while reading notebook data:', error);
                vscode.window.showErrorMessage('Failed to read notebook.');
            }
        } else {
            vscode.window.showInformationMessage('No notebook currently open.');
        }
    });

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
