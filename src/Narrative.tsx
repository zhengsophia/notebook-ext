// import * as React from 'react';

import { ReactElement, JSXElementConstructor, ReactNode, ReactPortal, Key } from "react";
import vscode from "./vscodeApi";

interface FormattedTextProps {
  content: string; 
  onLinkClick?: (cellInfo: string) => void; 
}

const FormattedText: React.FC<FormattedTextProps> = ({
  content,
  onLinkClick = (cellInfo: any) => console.log("Link clicked:", cellInfo),
}) => {
  // separate out references
  const parseTechDoc = (text = "") => {
    const references: any[] = [];
    const sections: string[] = [];
    
    let lastIndex = 0;
    const pattern = /\{([^}]+)\}\[([^\]]+)\]/g;
    let match;
  
    // Iterate through all matches
    while ((match = pattern.exec(text)) !== null) {
      // Add text before the match
      sections.push(text.slice(lastIndex, match.index));
      
      // Add the reference
      references.push({
        content: match[1].trim(), // reference text without braces
        cells: match[2].trim(),
      });
  
      lastIndex = pattern.lastIndex;
    }
  
    // Add any remaining text after the last match
    sections.push(text.slice(lastIndex));
  
    console.log('sections',sections);
    return { parts:sections, references };
  };


  const { parts, references } = parseTechDoc(content);
  console.log('parts',parts);


  // Reconstruct the document with hyperlinks
  const renderContent = () => {
    const { parts, references } = parseTechDoc(content);
    const sections = parts;

    console.log('secs', sections, 'ref', references);
    return sections.map((section, index) => (
      <span key={index}>
        {section}
        {index < references.length && (
          <span  onClick={()=>{
            console.log('reference', references[index],"index", index);

            // parse references[index].cells for the first number and pass in the cell number
            onLinkClick(references[index].cells);
          }} style={{ color: 'blue', cursor: 'pointer' }}>
            {references[index].content.replace(/^['"]|['"]$/g, '')}
          </span>
        )}
      </span>
    ));
  };
  
  return (
    <div className="content-wrapper">
      <div className="narrative-container">
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2D3748', marginBottom: '1rem' }}>
            Notebook Narrative
          </h2>
          <div style={{ fontSize: '14px', color: '#4A5568' }}>
            {renderContent()}
          </div>
        </div>
      </div>
      {/* <div className="cells-container">
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#4A5568', marginBottom: '1rem' }}>
          Referenced Cells:
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        </div>
      </div> */}
    </div>
  );
};

export function parseFirstCellNumber(cellsString: string): number | null {
    // Use regex to find the first number in the string
    const match = cellsString.match(/\d+/);
    if (match) {
        return parseInt(match[0], 10); // Subtract 1 to convert from 1-based to 0-based index
    }
    return null;
}

// Demo component showing the TechDocDisplay in action
const Narrative = ({data}:any) => {

  const handleNodeSelect = (cellId: string) => {

    const cellIndex = parseFirstCellNumber(cellId);
    console.log('cellIndex',cellIndex,cellId);
    const payload = { type: "selectCell", index: cellIndex }
    vscode?.postMessage(payload);
    
  };



  return (
    <div>
      <FormattedText onLinkClick={handleNodeSelect} content={data?.narrative} />
    </div>
  );
};


export default Narrative;