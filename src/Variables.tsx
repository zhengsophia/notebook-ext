import * as React from 'react';
import vscode from "./vscodeApi";

export default function List({ data }: { data: string[] }) {
  const handleClick = (variableName: string) => {
    console.log(variableName);
    vscode?.postMessage({ type: "selectVariable", name: variableName });
  };

  return (
    <div className="variables-container">
      <h2 className="variables-title">Variables</h2>
      <div className="variables-list">
        {data.map((variable, index) => (
          <span 
            key={index} 
            onClick={() => handleClick(variable)} 
            className="variable-tag"
          >
            {variable}
          </span>
        ))}
      </div>
    </div>
  );
}


// export default function List({ data }: { data: string[] }) {
//   const handleClick = (variableName: string) => {
//     console.log(variableName)
//     vscode?.postMessage({ type: "selectVariable", name: variableName });
//   };

//   return (
//     <div className="variables-container">
//       <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2D3748', marginBottom: '1rem' }}>
//         Variables
//       </h2>
//       <ul>
//         {data.map((variable, index) => (
//           <li
//             key={index}
//             onClick={() => handleClick(variable)}
//             style={{
//               width: 'fit-content',
//               display: 'list-item',
//             }}
//           >
//             {variable}
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }

