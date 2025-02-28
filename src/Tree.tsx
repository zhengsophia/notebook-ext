import * as React from 'react';
import Box from '@mui/material/Box';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import vscode from "./vscodeApi";
import { TreeItem2, TreeItem2Props } from '@mui/x-tree-view/TreeItem2';
import Narrative from './Narrative';
import Typography from '@mui/material/Typography';
import { useTreeItem2Utils } from '@mui/x-tree-view/hooks';

//TRY 2
// Parse the first cell number from a cell reference string
export function parseFirstCellNumber(cellsString: string): number | null {
  // Use regex to find the first number in the string
  const match = cellsString.match(/\d+/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return null;
}

// Custom NarrativeLabel component with formatted links
interface NarrativeLabelProps {
  sentence: string;
  className: string;
}

function NarrativeLabel({ sentence, className }: NarrativeLabelProps) {
  // Parse the sentence to extract text parts and references
  const parseTechDoc = (text = "") => {
    const references: any[] = [];
    const sections: string[] = [];

    let lastIndex = 0;
    const pattern = /\{([^}]+)\}\[([^\]]+)\]/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // Push text before the match
      sections.push(text.slice(lastIndex, match.index));

      // Push reference object
      references.push({
        content: match[1].trim(),
        cells: match[2].trim(),
      });

      lastIndex = pattern.lastIndex;
    }

    // Add remaining text after the last match
    sections.push(text.slice(lastIndex));

    return { parts: sections, references };
  };

  // Handle cell reference click
  const handleCellClick = (cellsInfo: string) => {
    const cellIndex = parseFirstCellNumber(cellsInfo);
    if (cellIndex !== null) {
      console.log('Cell reference clicked:', cellIndex);
      vscode?.postMessage({ type: "selectCell", index: cellIndex });
    }
  };

  // Render the content with formatted links
  const renderContent = () => {
    const { parts, references } = parseTechDoc(sentence);
    
    return parts.map((section, index) => (
      <React.Fragment key={index}>
        {section}
        {index < references.length && (
          <span 
            onClick={() => handleCellClick(references[index].cells)}
            style={{ color: '#4299e1', cursor: 'pointer' }}
          >
            {references[index].content.replace(/^['"]|['"]$/g, '')}
          </span>
        )}
      </React.Fragment>
    ));
  };
  
  return (
    <span className={className}>
      {renderContent()}
    </span>
  );
}

// Interface to extend TreeItem with custom data
interface CustomItemData {
  isNarrative?: boolean;
  sentence?: string;
}

// Custom TreeItem component that conditionally renders different label types
const CustomTreeItem = React.forwardRef(function CustomTreeItem(
  props: TreeItem2Props,
  ref: React.Ref<HTMLLIElement>,
) {
  const { publicAPI } = useTreeItem2Utils({
    itemId: props.itemId,
    children: props.children,
  });
  
  const item = publicAPI.getItem(props.itemId) as TreeViewBaseItem & CustomItemData;
  
  // If this is a narrative item, use the NarrativeLabel component for the label
  if (item?.isNarrative) {
    return (
      <TreeItem2
        {...props}
        ref={ref}
        slots={{
          label: NarrativeLabel,
        }}
        slotProps={{
          label: { sentence: item.sentence || '' } as NarrativeLabelProps,
        }}
      />
    );
  }
  
  // Otherwise use the default label rendering
  return <TreeItem2 {...props} ref={ref} />;
});

// Modified conversion function that marks narrative items
const convertToTreeViewItems = (
  json: any,
  narrativeMapping: { [cell: number]: string[] },
  parentId = ""
): TreeViewBaseItem[] => {
  return json.groups.map((group: any, groupIndex: number) => {
    const groupId = `${parentId}group-${groupIndex}`;
    return {
      id: groupId,
      label: group.name, // Basic string label for groups
      children: group.subgroups.map((subgroup: any, subgroupIndex: number) => {
        const subgroupId = `${groupId}-subgroup-${subgroupIndex}`;
        // Create narrative items with custom data
        const subgroupSentences: (TreeViewBaseItem & CustomItemData)[] = subgroup.cells.flatMap((cell: number) =>
          (narrativeMapping[cell] || []).map((sentence, i) => ({
            id: `${subgroupId}-narrative-${cell}-${i}`,
            label: sentence, // This is still needed but won't be directly displayed
            cellIndex: cell, // Store the cell index for click handler
            // Add custom data for the Narrative component
            isNarrative: true,
            sentence: sentence,
          }))
        );
        return {
          id: subgroupId,
          label: subgroup.name,
          children: subgroupSentences,
        };
      }),
    };
  });
};

export default function BasicRichTreeView({ data, narrativeMapping }: { data: any; narrativeMapping: { [cell: number]: string[] } }) {
  console.log('narrative mapping', narrativeMapping);
  const items = React.useMemo(
    () => convertToTreeViewItems(data, narrativeMapping), 
    [data, narrativeMapping]
  );
  console.log('converted items', items);
  
  const handleNodeSelect = (event: React.SyntheticEvent, nodeId: string) => {
    if (nodeId.includes('narrative')) {
      // Extract the cell index from the nodeId
      const match = nodeId.match(/-narrative-(\d+)-/);
      if (match && match[1]) {
        const cellIndex = parseInt(match[1], 10);
        console.log('selected cell index', cellIndex);
        // Post the selected cell index to the VSCode extension
        vscode?.postMessage({ type: "selectCell", index: cellIndex });
      }
    }
  };
  
  return (
    <Box sx={{ minWidth: 250 }}>
      {items.length > 0 ? (
        <RichTreeView 
          items={items}
          onItemClick={handleNodeSelect}
          slots={{ item: CustomTreeItem }}
          sx={{
            '& .MuiTreeItem-label': {
              fontSize: '12px !important',
              textAlign: 'left', 
            },
          }}
        />
      ) : (
        <p>Loading notebook data...</p> 
      )}
    </Box>
  );
}


// TRY 1
// interface NarrativeLabelProps {
//   sentence: string;
//   className: string;
// }

// function NarrativeLabel({ sentence, className }: NarrativeLabelProps) {
//   return (
//     <div className={className}>
//       <Narrative>{sentence}</Narrative>
//     </div>
//   );
// }

// const convertToTreeViewItems = (
//   json: any,
//   narrativeMapping: { [cell: number]: string[] },
//   parentId = ""
// ): TreeViewBaseItem[] => {
//   return json.groups.map((group: any, groupIndex: number) => {
//     const groupId = `${parentId}group-${groupIndex}`;
//     return {
//       id: groupId,
//       label: group.name, // Basic string label for groups
//       children: group.subgroups.map((subgroup: any, subgroupIndex: number) => {
//         const subgroupId = `${groupId}-subgroup-${subgroupIndex}`;

//         // Collect sentences as label components
//         const subgroupSentences: TreeViewBaseItem[] = subgroup.cells.flatMap((cell: number) =>
//           (narrativeMapping[cell] || []).map((sentence, i) => ({
//             id: `${subgroupId}-narrative-${cell}-${i}`,
//             // label: `${sentence}`,
//             labelComponent: (
//               <NarrativeLabel 
//                 sentence={sentence} 
//                 className="custom-narrative-label" 
//               />
//             ),
//           }))
//         );

//         return {
//           id: subgroupId,
//           label: subgroup.name,
//           children: subgroupSentences,
//         };
//       }),
//     };
//   });
// };



// export default function BasicRichTreeView({ data, narrativeMapping }: { data: any; narrativeMapping: { [cell: number]: string[] } }) {
//   console.log('narrative mapping', narrativeMapping)  
//   const labels = React.useMemo(() => convertToTreeViewItems(data, narrativeMapping), [data, narrativeMapping]);
//   console.log('converted items', labels)
//   const handleNodeSelect = (event: React.SyntheticEvent, nodeId: string) => {
//     if (nodeId.includes('cell')) {
//       const cellIndex = nodeId.split("-cell-").pop();
//       console.log('node id', nodeId)
//       if (cellIndex) {
//         console.log('current cell index', cellIndex)
//         // Post the selected cell index to the VSCode extension
//         vscode?.postMessage({ type: "selectCell", index: parseInt(cellIndex, 10) });
//       }
//     }
//   };

//   return (
//     <Box sx={{ minWidth: 250 }}>
//       {labels.length > 0 ? (
//         <RichTreeView 
//         items={labels}
//         onItemClick={handleNodeSelect}
//         // slots={{ item: CustomTreeItem }}
//         sx={{
//           '& .MuiTreeItem-label': {
//             fontSize: '12px !important',
//             textAlign: 'left', 
//           },
//         }}
//       />
//       ) : (
//         <p>Loading notebook data...</p> 
//       )}
//     </Box>
//   );
// }

// const convertToTreeViewItems = (json: any, parentId = ""): TreeViewBaseItem[] => {
//   return json.groups.map((group: any, groupIndex: number) => {
//     const groupId = `${parentId}group-${groupIndex}`;
//     return {
//       id: groupId,
//       label: group.name,
//       children: group.subgroups.map((subgroup: any, subgroupIndex: number) => {
//         const subgroupId = `${groupId}-subgroup-${subgroupIndex}`;
//         return {
//           id: subgroupId,
//           label: subgroup.name,
//           children: subgroup.cells.map((cell: number) => ({
//             id: `${subgroupId}-cell-${cell}`,
//             label: <Narrative data={`Content for Cell ${cell}`} />,
//             index: cell,
//           })),
//         };
//       }),
//     };
//   });
// };

// export default function BasicRichTreeView({ data }: { data: any }) {
//   const labels = React.useMemo(() => convertToTreeViewItems(data), [data]);

//   const handleNodeSelect = (event: React.SyntheticEvent, nodeId: string) => {
//     if (nodeId.includes('cell')) {
//       const cellIndex = nodeId.split("-cell-").pop();
//       console.log('node id', nodeId);
//       if (cellIndex) {
//         console.log('current cell index', cellIndex);
//         vscode?.postMessage({ type: "selectCell", index: parseInt(cellIndex, 10) });
//       }
//     }
//   };

//   return (
//     <Box sx={{ minWidth: 250 }}>
//       {labels.length > 0 ? (
//         <RichTreeView 
//           items={labels}
//           onItemClick={handleNodeSelect}
//           sx={{
//             '& .MuiTreeItem-label': {
//               fontSize: '12px !important',
//               textAlign: 'left',
//             },
//           }}
//         />
//       ) : (
//         <p>Loading notebook data...</p> 
//       )}
//     </Box>
//   );
// }

// const MUI_X_PRODUCTS: TreeViewBaseItem[] = [
//   {
//     id: 'grid',
//     label: 'Data Grid',
//     children: [
//       { id: 'grid-community', label: '@mui/x-data-grid' },
//       { id: 'grid-pro', label: '@mui/x-data-grid-pro' },
//       { id: 'grid-premium', label: '@mui/x-data-grid-premium' },
//     ],
//   },
//   {
//     id: 'pickers',
//     label: 'Date and Time Pickers',
//     children: [
//       { id: 'pickers-community', label: '@mui/x-date-pickers' },
//       { id: 'pickers-pro', label: '@mui/x-date-pickers-pro' },
//     ],
//   },
//   {
//     id: 'charts',
//     label: 'Charts',
//     children: [{ id: 'charts-community', label: '@mui/x-charts' }],
//   },
//   {
//     id: 'tree-view',
//     label: 'Tree View',
//     children: [{ id: 'tree-view-community', label: '@mui/x-tree-view' }],
//   },
// ];

// export default function BasicRichTreeView() {
//   return (
//     <Box sx={{ minHeight: 352, minWidth: 250 }}>
//       <RichTreeView items={MUI_X_PRODUCTS} />
//     </Box>
//   );
// }