import * as React from 'react';
import vscode from "./vscodeApi";

export default function List({ data }: { data: string[] }) {
  const handleClick = (variableName: string) => {
    console.log(variableName)
    vscode?.postMessage({ type: "selectVariable", name: variableName });
  };

  return (
    <div>
      <ul>
        {data.map((variable, index) => (
          <li
            key={index}
            onClick={() => handleClick(variable)}
            style={{
              width: 'fit-content',
              display: 'list-item',
            }}
          >
            {variable}
          </li>
        ))}
      </ul>
    </div>
  );
}
