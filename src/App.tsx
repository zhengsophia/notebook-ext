import * as React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import BasicRichTreeView from './Tree';
import List from './Variables';
import Narrative from './Narrative';
import { split } from 'sentence-splitter';

function extractCellReferences(text: string): { [cell: number]: string[] } {
  // Split text into sentences, handling periods in cell references
  const sentenceEndRegex = /[.!?](?=\s|$)/g;
  let sentences: string[] = [];
  let lastIndex = 0;

  // Find all sentence endings
  let match;
  while ((match = sentenceEndRegex.exec(text)) !== null) {
    // Check if we're inside a cell reference by counting brackets
    const subText = text.substring(0, match.index + 1);
    const openBrackets = (subText.match(/\{/g) || []).length;
    const closeBrackets = (subText.match(/\}/g) || []).length;

    // If brackets are balanced, this is a real sentence end
    if (openBrackets === closeBrackets) {
      sentences.push(text.substring(lastIndex, match.index + 1).trim());
      lastIndex = match.index + 1;
    }
  }

  // Add the last sentence if needed
  if (lastIndex < text.length) {
    sentences.push(text.substring(lastIndex).trim());
  }

  console.log('sentences after splitting:', sentences);

  // Extract cell references with support for multiple cell numbers
  const extracted: { [cell: number]: string[] } = {};

  // Cell regex that can handle multiple cell numbers
  const cellRegex = /\{"([^"}]+)"}\[cell\s*(\d+(?:\s*,\s*\d+)*)\]/g;

  for (const sentence of sentences) {
    let match;
    while ((match = cellRegex.exec(sentence)) !== null) {
      console.log('matched cell regex', match);
      const cellNumbers = match[2]
        .split(',')
        .map((num) => parseInt(num.trim(), 10));
      console.log('cellNumbers', cellNumbers);
      // cellNumbers.forEach(cellNumber => {
      //   if (!extracted[cellNumber]) extracted[cellNumber] = [];
      //   extracted[cellNumber].push(sentence.trim());
      // });
      if (!extracted[cellNumbers[0]]) extracted[cellNumbers[0]] = [];
      extracted[cellNumbers[0]].push(sentence.trim());
    }
  }

  console.log('extracted:', extracted);
  return extracted;
}

function extractFirstSentence(text: string): string {
  const match = text.match(/.*?[.?!](\s|$)/);
  if (match) {
    return match[0].trim();
  }
  return text.trim();
}

function App() {
  const [variables, setVariables] = React.useState<any>(null);
  const [tree, setTree] = React.useState<any>(null);
  // const [narrative, setNarrative] = React.useState<any>(null);
  const [narrativeMapping, setNarrativeMapping] = React.useState<{
    [cell: number]: string[];
  }>({});
  const [variableSummary, setVariableSummary] = React.useState<string | null>(
    ''
  );

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
        setNarrativeMapping({});
        setVariableSummary(null);
      }
      if (message.command === 'fetchNarrative') {
        console.log('Received data from TreeViewProvider:', message.data);
        // setNarrative(message.data);
        setNarrativeMapping(extractCellReferences(message.data));
        setVariableSummary(extractFirstSentence(message.data));
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="notebook-container">
      <div className="top-section">
        {variables ? (
          <List data={variables} />
        ) : (
          <p className="loading-text">Loading notebook data…</p>
        )}
      </div>

      <div className="bottom-section">
        {tree ? (
          <BasicRichTreeView
            data={tree}
            narrativeMapping={narrativeMapping}
            variableSummary={variableSummary}
          />
        ) : (
          <p className="loading-text">Loading notebook data…</p>
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
