import * as React from 'react';
import Box from '@mui/material/Box';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import vscode from "./vscodeApi";
import { TreeItem2, TreeItem2Props } from '@mui/x-tree-view/TreeItem2';
import Narrative from './Narrative';
import Typography from '@mui/material/Typography';
import { useTreeItem2Utils } from '@mui/x-tree-view/hooks';

// const CustomTreeItem = React.forwardRef(function CustomTreeItem(
//   props: TreeItem2Props,
//   ref: React.Ref<HTMLLIElement>
// ) {
//   const { publicAPI } = useTreeItem2Utils({
//     itemId: props.itemId,
//     children: props.children,
//   });

//   const item = publicAPI.getItem(props.itemId);

//   return (
//     <TreeItem2
//       {...props}
//       ref={ref}
//       slots={{
//         label: NarrativeLabel, // Use NarrativeLabel as the label slot
//       }}
//       slotProps={{
//         label: { sentence: item?.labelComponent?.props.sentence || '' }, // Pass sentence here
//       }}
//     />
//   );
// });


// // Define the Custom Narrative Label Component
// interface NarrativeLabelProps {
//   sentence: string;
// }

// const NarrativeLabel: React.FC<NarrativeLabelProps> = ({ sentence }) => {
//   return (
//     <Narrative data={sentence}/>
//   );
// };



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
//             label: `Cell ${cell}`,
//             index: cell,
//           })),
//         };
//       }),
//     };
//   });
// };
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

        // Collect sentences as label components
        const subgroupSentences: TreeViewBaseItem[] = subgroup.cells.flatMap((cell: number) =>
          (narrativeMapping[cell] || []).map((sentence, i) => ({
            id: `${subgroupId}-narrative-${cell}-${i}`,
            label: `${sentence}`,
            // labelComponent: <NarrativeLabel sentence={sentence} className="custom-narrative-label" />, // Send sentence here
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
  console.log('narrative mapping', narrativeMapping)  
  const labels = React.useMemo(() => convertToTreeViewItems(data, narrativeMapping), [data, narrativeMapping]);
  console.log('converted items', labels)
  const handleNodeSelect = (event: React.SyntheticEvent, nodeId: string) => {
    if (nodeId.includes('cell')) {
      const cellIndex = nodeId.split("-cell-").pop();
      console.log('node id', nodeId)
      if (cellIndex) {
        console.log('current cell index', cellIndex)
        // Post the selected cell index to the VSCode extension
        vscode?.postMessage({ type: "selectCell", index: parseInt(cellIndex, 10) });
      }
    }
  };

  return (
    <Box sx={{ minWidth: 250 }}>
      {labels.length > 0 ? (
        <RichTreeView 
        items={labels}
        onItemClick={handleNodeSelect}
        // slots={{ item: CustomTreeItem }}
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