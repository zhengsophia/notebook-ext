import * as React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import BasicRichTreeView from './Tree';
import List from './Variables';

function App() {
    const [variables, setVariables] = React.useState<any>(null);
    const [tree, setTree] = React.useState<any>(null);

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

        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return (
        <div>
            <div>
                {variables ? (
                    <List data={variables} />
                ) : (
                    <p>Loading notebook data...</p>
                )}
            </div>

            <div>
                {tree ? (
                    <BasicRichTreeView data={tree} />
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