import * as React from 'react';
import Select from 'react-select';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Popper, { PopperProps } from '@mui/material/Popper';
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import vscode from './vscodeApi';
import { TreeItem2, TreeItem2Props } from '@mui/x-tree-view/TreeItem2';
import Typography from '@mui/material/Typography';
import { useTreeItem2Utils } from '@mui/x-tree-view/hooks';

// const convertClusterDataToTree = (
//   data: { cluster: string; variables: { name: string; frequency: number }[] }[],
//   minFreq: number,
//   maxFreq: number
// ): TreeViewBaseItem[] => {
//   return data.map((clusterItem, clusterIndex) => {
//     const clusterId = `cluster-${clusterIndex}`;
//     return {
//       id: clusterId,
//       label: clusterItem.cluster,
//       children: clusterItem.variables.map((variable, varIndex) => {
//         return {
//           id: `${clusterId}-var-${varIndex}`,
//           label: variable.name,
//           frequency: variable.frequency,
//           isVariable: true, // For conditional styling or handling
//         };
//       }),
//     };
//   });
// };

window.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'selectArtifact') {
    const variable = message.name;
    console.log('clicked variable', variable);
    addVariableToList(variable);
  }
});

const variablesSet = new Set();
let selectedVariable: string | null = null;

// helper fn to select & clear other selected tags
function selectTag(tag: HTMLElement, variable: string) {
  // clear unpinned tags
  document.querySelectorAll('.variable-tag:not(.pinned)').forEach((el) => {
    if (el !== tag) {
      const name = el.querySelector<HTMLElement>('.label')?.textContent;
      if (name) variablesSet.delete(name);
      el.remove();
    }
  });
  // clear other selected tags
  document
    .querySelectorAll('.variable-tag.selected')
    .forEach((el) => el.classList.remove('selected'));

  tag.classList.add('selected');
  handleClick(variable);
}

// helper fn to make tag
function initTag(variable: string): HTMLElement {
  const tag = document.createElement('span');
  tag.className = 'variable-tag';

  // var name
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = variable;
  tag.appendChild(label);

  // pin or X button
  const btn = document.createElement('button');
  btn.className = 'pin-btn';
  btn.textContent = '📌';
  tag.appendChild(btn);

  // clicking the name selects it
  label.onclick = () => selectTag(tag, variable);

  // clicking the pin toggles pin/unpin
  btn.onclick = (e) => {
    e.stopPropagation();

    if (!tag.classList.contains('pinned')) {
      // 📌 → ✖ : pin it
      tag.classList.add('pinned');
      btn.textContent = '✖';
    } else {
      // ✖ → remove : unpin & delete
      tag.remove();

      // clear selection if it on this tag
      if (tag.classList.contains('selected')) {
        tag.classList.remove('selected');
      }
    }
  };

  return tag;
}

// handle passing the IN LINE TEXTUAL SUMMARIES to the TREE VIEW
const handleClick = (variableName: string) => {
  selectedVariable = variableName;
  console.log(variableName);
  vscode?.postMessage({ type: 'selectVariable', name: variableName });
};

// adding the variable spans from editor to VARIABLES PANE
function addVariableToList(variable: any) {
  // console.log('variablesSet', variablesSet);
  if (variablesSet.has(variable)) return;

  const container = document.getElementById('variables-list')!;
  // remove existing unpinned tags
  container
    .querySelectorAll('.variable-tag:not(.pinned)')
    .forEach((el) => el.remove());

  // init tag
  const tag = initTag(variable);
  container.prepend(tag);
  selectTag(tag, variable);

  // delete any unpinned tags
  document.querySelectorAll('.variable-tag:not(.pinned)').forEach((el) => {
    if (el !== tag) {
      const name = el.querySelector<HTMLElement>('.label')?.textContent;
      if (name) variablesSet.delete(name);
      el.remove();
    }
  });
}

// // Function to calculate background color based on frequency using dynamic 5-bin color scheme
// const getColorForFrequency = (
//   frequency: number,
//   minFreq: number,
//   maxFreq: number
// ) => {
//   // Calculate the bin ranges (min-max range divided into 5 bins)
//   const range = maxFreq - minFreq;
//   const binSize = range / 10;

//   // Determine which bin the frequency falls into
//   let binIndex = Math.floor((frequency - minFreq) / binSize);

//   binIndex = Math.min(9, Math.max(0, binIndex));

//   const colorScale = [
//     'rgb(255, 255, 255)', // White for very low frequencies
//     'rgb(255, 230, 230)', // Very light red
//     'rgb(255, 204, 204)', // Light red for low frequencies
//     'rgb(255, 179, 128)', // Light orange
//     'rgb(255, 128, 0)', // Orange
//     'rgb(204, 102, 0)', // Dark orange
//     'rgb(255, 76, 76)', // Orange
//     'rgb(255, 51, 51)', // Dark orange
//     'rgb(255, 0, 0)',
//     'rgb(153, 0, 0)', // Dark red for high frequencies
//   ];

//   return colorScale[binIndex];
// };

// // Helper function to calculate luminance and determine text color
// const getTextColor = (backgroundColor: string) => {
//   // Extract RGB values from the background color (e.g., "rgb(255, 255, 255)")
//   const match = backgroundColor.match(/\d+/g);
//   if (match && match.length === 3) {
//     const [r, g, b] = match.map(Number);

//     // Normalize RGB values to the range [0, 1]
//     const normalizedR = r / 255;
//     const normalizedG = g / 255;
//     const normalizedB = b / 255;

//     // Calculate luminance
//     const luminance =
//       0.2126 * normalizedR + 0.7152 * normalizedG + 0.0722 * normalizedB;

//     // Return black text for light backgrounds, white for dark
//     return luminance > 0.5 ? 'black' : 'white';
//   }
//   // Default to black if the color is not in the expected format
//   return 'black';
// };

// const CustomTreeItem = React.forwardRef(function CustomTreeItem(
//   props: TreeItem2Props,
//   ref: React.Ref<HTMLLIElement>
// ) {
//   const { publicAPI } = useTreeItem2Utils({
//     itemId: props.itemId,
//     children: props.children,
//   });

//   const item = publicAPI.getItem(props.itemId) as TreeViewBaseItem & {
//     frequency?: number;
//   };

//   const backgroundColor =
//     item.frequency !== undefined
//       ? getColorForFrequency(item.frequency, 0, 100) // You can pass min/max dynamically
//       : 'transparent';

//   const color = getTextColor(backgroundColor);

//   return (
//     <TreeItem2
//       {...props}
//       ref={ref}
//       // slots={{
//       //   label: NarrativeLabel,
//       // }}
//     />
//   );
// });

// export default function VariableTreeView({ data }: { data: any }) {
//   const allFrequencies = data.flatMap((d: any) =>
//     d.variables.map((v: any) => v.frequency)
//   );
//   const minFreq = Math.min(...allFrequencies);
//   const maxFreq = Math.max(...allFrequencies);

//   const treeItems = React.useMemo(
//     () => convertClusterDataToTree(data, minFreq, maxFreq),
//     [data]
//   );

//   const handleItemClick = (_: React.SyntheticEvent, nodeId: string) => {
//     const match = nodeId.match(/var-\d+/);
//     if (match) {
//       const variableName = treeItems
//         .flatMap((c) => c.children ?? [])
//         .find((v) => v.id === nodeId)?.label;

//       if (variableName) {
//         vscode?.postMessage({ type: 'selectVariable', name: variableName });
//       }
//     }
//   };

//   return (
//     <Box sx={{ minWidth: 250 }}>
//       <RichTreeView
//         items={treeItems}
//         onItemClick={handleItemClick}
//         slots={{ item: CustomTreeItem }}
//       />
//     </Box>
//   );
// }

// LIST VERSION
export default function List({
  data,
}: {
  data: { cluster: string; variables: { name: string; frequency: number }[] }[];
}) {
  // Calculate min and max frequencies across all clusters and variables
  const allFrequencies = data.flatMap(({ variables }) =>
    variables.map((v) => v.frequency)
  );
  const minFreq = Math.min(...allFrequencies);
  const maxFreq = Math.max(...allFrequencies);

  // flatten the variables passed in
  const names = Array.from(
    new Set(data.flatMap((grp) => grp.variables.map((v) => v.name)))
  );

  // search functionality for selecting from the dropdown
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (names.includes(val)) {
      addVariableToList(val);
      // clear input so you can pick again
      e.target.value = '';
    }
  };

  return (
    <div className="variables-container">
      <Autocomplete
        freeSolo
        options={names}
        openOnFocus
        onChange={(_, value) => {
          if (typeof value === 'string' && value) {
            addVariableToList(value);
          }
        }}
        sx={{
          width: 'calc(100% - 1em)',
          margin: '0.5em',
          '& .MuiOutlinedInput-root': {
            maxHeight: 22,
            backgroundColor: 'white',
            '& .MuiOutlinedInput-input': {
              padding: '4px 8px',
              fontSize: 12,
              lineHeight: 1.2,
            },
          },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="🔎 Search for variables..."
            size="small"
            fullWidth
            variant="outlined"
          />
        )}
        slotProps={{
          listbox: {
            sx: {
              p: 0,
              maxHeight: 200,
              overflowY: 'auto',
              '& .MuiAutocomplete-option': {
                py: 0, // no top/bottom padding
                px: 1, // theme.spacing(1) ≈ 8px left/right
                minHeight: 0, // kill any built-in minimum
                height: '1.5em',
                lineHeight: 1.5,
                fontSize: 12,
              },
            },
          },
        }}
      />

      <div id="variables-list" />
      {/* <div className="clusters">
        {data.map(({ cluster, variables }) => (
          <div key={cluster} className="cluster">
            <span
              onClick={() => handleClick(cluster)}
              className={`cluster-tag ${selectedVariable === cluster ? 'selected' : ''}`}
              style={{
                backgroundColor: getColorForFrequency(
                  variables.reduce((acc, v) => acc + v.frequency, 0),
                  minFreq,
                  maxFreq
                ),
                color: getTextColor(
                  getColorForFrequency(
                    variables.reduce((acc, v) => acc + v.frequency, 0),
                    minFreq,
                    maxFreq
                  )
                ), // Dynamically change text color
              }}
            >
              {cluster}
            </span>
            <div className="variables-list">
              {variables.map(({ name, frequency }, index) => (
                <span
                  key={index}
                  onClick={() => handleClick(name)}
                  className={`variable-tag ${selectedVariable === name ? 'selected' : ''}`}
                  style={{
                    backgroundColor: getColorForFrequency(
                      frequency,
                      minFreq,
                      maxFreq
                    ), // Apply dynamic color
                    color: getTextColor(
                      getColorForFrequency(frequency, minFreq, maxFreq)
                    ), // Dynamically change text color
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div> */}
    </div>
  );
}

// export default function List({ data }: { data: { cluster: string; variables: string[] }[] }) {
//   const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
//   const handleClick = (variableName: string) => {
//     setSelectedVariable(variableName);
//     console.log(variableName);
//     vscode?.postMessage({ type: "selectVariable", name: variableName });
//   };

//   return (
//     <div className="variables-container">
//       {/* <h2 className="variables-title">Variables</h2> */}
//       <div className="clusters">
//         {data.map(({ cluster, variables }) => (
//           <div key={cluster} className="cluster">
//             <span
//                 onClick={() => handleClick(cluster)}
//                 className={`cluster-tag ${selectedVariable === cluster ? "selected" : ""}`}
//               >
//                 {cluster}
//               </span>
//             <div className="variables-list">
//               {variables.map((variable, index) => (
//                 <span
//                   key={index}
//                   onClick={() => handleClick(variable)}
//                   className={`variable-tag ${selectedVariable === variable ? "selected" : ""}`}
//                 >
//                   {variable}
//                 </span>
//               ))}
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );

//   // return (
//   //   <div className="variables-container">
//   //     <h2 className="variables-title">Variables</h2>
//   //     <div className="variables-list">
//   //       {data.map((variable, index) => (
//   //         <span
//   //           key={index}
//   //           onClick={() => handleClick(variable)}
//   //           className={`variable-tag ${selectedVariable === variable ? "selected" : ""}`}
//   //         >
//   //           {variable}
//   //         </span>
//   //       ))}
//   //     </div>
//   //   </div>
//   // );
// }

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
