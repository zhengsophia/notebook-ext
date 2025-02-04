declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
  };
  
  // Ensure the API is acquired only once
  const vscode = typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;
  
  export default vscode;
  