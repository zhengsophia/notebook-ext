import * as React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import BasicRichTreeView from './Tree';

function App() {
    const [treeData, setTreeData] = React.useState<any>(null);

    React.useEffect(() => {
        // listening for messages from the extension via TreeViewProvider
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.command === 'fetchNotebookData') {
                console.log('Received data from TreeViewProvider:', message.data);
                setTreeData(message.data);
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return (
        <div>
            {treeData ? (
                <BasicRichTreeView data={treeData} />
            ) : (
                <p>Loading notebook data...</p>
            )}
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