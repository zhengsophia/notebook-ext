import * as React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';

function App() {
    return (
        <div>
            <h1>Hello from React!</h1>
        </div>
    );
};

// iife for mounting the app
(function () {
    const rootElement = document.getElementById('app'); // Ensure this matches your webview HTML
    if (rootElement) {
        const root = ReactDOM.createRoot(rootElement);
        console.log('made it')
        root.render(<App />);
    } else {
        console.error('Root element not found.');
    }
  })();

// export default App;