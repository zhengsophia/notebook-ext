// import * as React from 'react';

import { ReactElement, JSXElementConstructor, ReactNode, ReactPortal, Key } from "react";

declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

const vscode = acquireVsCodeApi();

// export default function NarrativeView({ data }: { data: any }) {

//     const narrative = data.narrative;

//     return (
//         <div>{narrative}</div>
//     );
//   }


const DEMO_CONTENT = `TLDR: Logistic regression applied to text classification using an n-gram based TF-IDF pipeline. The dataset undergoes initial analysis with procedures such as identifying unique values in categories, starting with {"unique value counting in 'Cat1', 'Cat2', and 'Cat3'"}[cell 7, 8, 9]. Text data is preprocessed and transformed into numerical format by {"text vectorization with word counting and n-gram feature extraction"}[cell 10, 11, 12]. Subsequently, {"a TF-IDF vectorizer is configured with a logistic regression model"}[cell 13] into a pipeline structure, before being trained and validated on stratified datasets {"training and test split for text features"}[cell 15]. The pipeline undergoes fitting and prediction steps using logistic regression logistics {"pipeline fitting on training data"}[cell 16] and {"predicting on validation data"}[cell 17]. Evaluation metrics such as {"accuracy score of predictions"}[cell 18] are used along with visualization tools like {"plotting confusion matrices"}[cell 21] and {"visualizing model coefficients"}[cell 23, 24]. Further exploration with ELI5 displays model weights and specific predictions in {"model interpretation via ELI5"}[cell 26, 28]. Subsequently, an additional transformation combines multiple categories for joint prediction by {"combining 'Cat2' and 'Cat3' into 'Cat2_Cat3'"}[cell 29, 30] with follow-up classification and accuracy assessment of the combined predictions {"accuracy evaluation of combined category predictions"}[cell 34, 37, 38].`;

const FormattedText = ({
  content = DEMO_CONTENT,
  onLinkClick = (cellInfo: any) => console.log("Link clicked:", cellInfo),
}) => {
  // Parse the content to separate TLDR from references
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
        content: match[1].trim(),
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

    
    console.log('secs',sections, 'ref',references);
    return sections.map((section, index) => (
      <span key={index}>
        {section}
        {index < references.length && (
          <span  onClick={()=>{
            console.log('reference',references[index],"index",index);

            // parse references[index].cells for the first number and pass in the cell number
            onLinkClick(references[index].cells);

          }} className="text-blue-600">{references[index].content}</span>
        )}
      </span>
    ));
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Technical Documentation
        </h2>
        <div className="prose prose-lg text-gray-700 leading-relaxed">
          {renderContent()}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Referenced Cells:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
   
            {/*references.map((ref: { content: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; cells: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; }, index: Key | null | undefined) => (
              <div
                key={index}
                className="flex items-start p-4 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
              >
                <link
                  onClick={() =>
                    onLinkClick({
                      content: ref.content,
                      cells: ref.cells,
                    })
                  }
                  //className="text-left w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  {<div className="text-sm text-gray-500">
                    Cells: {ref.cells}
                  </div>}
                  <div className="text-blue-600 hover:text-blue-800 mt-1">
                    {ref.content}
                  </div>
                </link>
              </div>
            ))*/}
          </div>
        </div>
      </div>
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
    vscode.postMessage(payload);
    
  };



  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <FormattedText onLinkClick={handleNodeSelect} content={data?.narrative} />
    </div>
  );
};


export default Narrative;