import * as React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useState, useEffect, useMemo } from 'react';
import vscode from './vscodeApi';

window.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'sendHoveredVariable') {
    const variable = message.name;
    console.log('clicked variable', variable);
    addVariableToList(variable);
  }
});

// const variablesSet = new Set();
// let selectedVariable: string | null = null;

// helper fn to select & clear other selected tags
function toggleTag(tag: HTMLElement, variable: string) {
  const selected = tag.classList.contains('selected');

  // clear other selected tags
  document
    .querySelectorAll('.variable-tag.selected')
    .forEach((el) => el.classList.remove('selected'));

  if (!selected) {
    // select tag -> it and request summary
    tag.classList.add('selected');
    console.log(variable);
    // handle passing the IN LINE TEXTUAL SUMMARIES to the TREE VIEW
    vscode?.postMessage({ type: 'getVariableSummary', name: variable });
  } else {
    // deselect tag -> ask tree to clear narratives
    tag.classList.remove('selected');
    vscode?.postMessage({ type: 'clearTree' });
  }
}

// helper fn to make tag
function initTag(variable: string): HTMLElement {
  const tag = document.createElement('span');
  tag.className = 'variable-tag';
  tag.dataset.variable = variable;

  // var name
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = variable;
  tag.appendChild(label);

  // x button
  const btn = document.createElement('button');
  btn.className = 'pin-btn';
  btn.textContent = '✖';
  tag.appendChild(btn);

  // clicking the name selects/deselects it
  label.onclick = () => toggleTag(tag, variable);

  // clicking the pin toggles pin/unpin
  btn.onclick = (e) => {
    e.stopPropagation();
    const selected = tag.classList.contains('selected');
    if (selected) {
      vscode?.postMessage({ type: 'clearTree' });
    }
    // ✖ → remove to unpin & delete
    tag.remove();
    // clear selection if it on this tag
    if (tag.classList.contains('selected')) {
      tag.classList.remove('selected');
    }
  };
  return tag;
}

// handle passing the IN LINE TEXTUAL SUMMARIES to the TREE VIEW
// const handleClick = (variableName: string) => {
//   // selectedVariable = variableName;
//   console.log(variableName);
//   vscode?.postMessage({ type: 'getVariableSummary', name: variableName });
// };

// adding the variable spans from editor to VARIABLES PANE
/**
 * @param variable      the name
 * @param narrative  if false, don’t call selectTag (so no inline narrative)
 */
function addVariableToList(variable: any, narrative = true) {
  // console.log('variablesSet', variablesSet);
  const container = document.getElementById('variables-list')!;
  let tag = container.querySelector<HTMLElement>(
    `span.variable-tag[data-variable="${variable}"]`
  );
  if (!tag) {
    // variablesSet.add(variable);
    tag = initTag(variable);
    container.prepend(tag);
  }
  if (narrative) {
    toggleTag(tag, variable);
  }
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
//         vscode?.postMessage({ type: 'getVariableSummary', name: variableName });
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
  data: { name: string; frequency: number }[];
}) {
  console.log('data ok', data);
  // turn the data.variables into an actual dictionary
  const freqMap = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach(({ name, frequency }) => {
      m.set(name, (m.get(name) || 0) + frequency);
    });
    return m;
  }, [data]);

  // grabbing top 5 to prepopulate
  const top5 = useMemo(
    () =>
      Array.from(freqMap.entries())
        .sort(([, aFreq], [, bFreq]) => bFreq - aFreq)
        .slice(0, 5)
        .map(([name]) => name),
    [freqMap]
  );
  useEffect(() => {
    const container = document.getElementById('variables-list');
    if (container) {
      container.innerHTML = ''; // remove all old tags
    }
    top5.forEach((name) => addVariableToList(name, false));
  }, [top5]);

  const names = useMemo(
    () => [...new Set(data.map(({ name }) => name))],
    [data]
  );

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
                py: 0,
                px: 1,
                minHeight: 0,
                height: '1.5em',
                lineHeight: 1.5,
                fontSize: 12,
              },
            },
          },
        }}
      />
      <div id="variables-list" />
    </div>
  );
}
