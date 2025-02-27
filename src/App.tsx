import * as React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import BasicRichTreeView from './Tree';
import List from './Variables';
import Narrative from './Narrative';

function extractCellReferences(text: string): { [cell: number]: string[] } {
    const cellRegex = /\{"([^"}]+)"}\[cell (\d+)]/g;
    const sentences = text.match(/[^.?!]+[.?!]/g) || [text];
  
    const extracted: { [cell: number]: string[] } = {};
  
    for (const sentence of sentences) {
      let match;
      while ((match = cellRegex.exec(sentence)) !== null) {
        const cellNumber = parseInt(match[2], 10);
        if (!extracted[cellNumber]) extracted[cellNumber] = [];
        extracted[cellNumber].push(sentence.trim());
      }
    }
    console.log('extracted', extracted)
  
    return extracted;
  }  

function App() {
    const [variables, setVariables] = React.useState<any>(null);
    const [tree, setTree] = React.useState<any>(null);
    const [narrative, setNarrative] = React.useState<any>(null);
    const [narrativeMapping, setNarrativeMapping] = React.useState<{ [cell: number]: string[] }>({});

    React.useEffect(() => {
        // listening for messages from the extension via TreeViewProvider
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.command === 'fetchVariables') {
                console.log('Received data from TreeViewProvider:', message.data);
                setVariables(message.data);
            }

            if (message.command === 'fetchTree') {
                console.log('Received data from TreeViewProvider:', message.data);
                setTree(message.data);
            }

            if (message.command === 'fetchNarrative') {
                console.log('Received data from TreeViewProvider:', message.data);
                setNarrative(message.data);
                setNarrativeMapping(extractCellReferences(message.data));
            }

        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return (
        <div>
        <div className="top-section">
            {tree ? (
                <BasicRichTreeView data={tree} narrativeMapping={narrativeMapping} />
            ) : (
                <p>Loading notebook data...</p>
            )}

            {variables ? (
                <List data={variables} />
            ) : (
                <p>Loading notebook data...</p>
            )}
        </div>

        <div>
            {narrative ? (
                <Narrative data={narrative} />
            ) : (
                <p>Loading notebook data...</p>
            )}
        </div>
    </div>
    );    
}

// iife for mounting the app
(function () {
    const rootElement = document.getElementById('app'); // Ensure this matches your webview HTML
    if (rootElement) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(<App />);
    } else {
        console.error('Root element not found.');
    }
  })();