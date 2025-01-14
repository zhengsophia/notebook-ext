"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/webviews/treeViewProvider.tsx
var vscode = __toESM(require("vscode"));
var TreeViewProvider = class {
  constructor(_extensionUri) {
    this._extensionUri = _extensionUri;
  }
  static viewType = "meng-notebook.treeView";
  _view;
  // Implementing the required method
  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri)
      ]
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
  }
  // Helper method to get HTML content for the webview
  _getHtmlForWebview(webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "dist/webviews", "App.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "dist/webviews", "App.css"));
    console.log("script URI", scriptUri);
    console.log("style URI", styleUri);
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
};

// src/extension.ts
function activate(context) {
  console.log('Congratulations, your extension "notebook-ext" is now active!');
  context.subscriptions.push(
    vscode2.window.registerWebviewViewProvider(
      TreeViewProvider.viewType,
      new TreeViewProvider(context.extensionUri)
    )
  );
  const disposable = vscode2.commands.registerCommand("notebook-ext.getNotebookData", async () => {
    const editor = vscode2.window.activeNotebookEditor;
    console.log("editor info", editor);
    if (editor) {
      try {
        const notebookUri = editor.notebook.uri;
        const doc = await vscode2.workspace.openTextDocument(notebookUri);
        const notebookData = doc.getText();
        console.log("notebookData:", notebookData);
        const notebookJson = JSON.parse(notebookData);
        console.log("notebookJson:", notebookJson);
      } catch (error) {
        console.error("Error while reading notebook data:", error);
        vscode2.window.showErrorMessage("Failed to read notebook.");
      }
    } else {
      vscode2.window.showInformationMessage("No notebook currently open.");
    }
  });
  context.subscriptions.push(disposable);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
