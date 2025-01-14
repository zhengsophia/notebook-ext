import * as React from 'react';
import { useEffect, useState } from "react";
import Box from '@mui/material/Box';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';

const convertToTreeViewItems = (json: any, parentId = ""): TreeViewBaseItem[] => {
  return json.groups.map((group: any, groupIndex: number) => {
    const groupId = `${parentId}group-${groupIndex}`;
    return {
      id: groupId,
      label: group.name,
      children: group.subgroups.map((subgroup: any, subgroupIndex: number) => {
        const subgroupId = `${groupId}-subgroup-${subgroupIndex}`;
        return {
          id: subgroupId,
          label: subgroup.name,
          children: subgroup.cells.map((cell: number) => ({
            id: `${subgroupId}-cell-${cell}`,
            label: `Cell ${cell}`,
          })),
        };
      }),
    };
  });
};

// export default function BasicRichTreeView() {
//   const [labels, setLabels] = useState<TreeViewBaseItem[]>([]);

//   useEffect(() => {
//     console.log("useEffect triggered");

//     const fetchNotebook = async () => {
//       try {
//         const response = await fetch('http://localhost:3001/notebooks/twitter-sentiment-extaction-analysis-eda-and-model.ipynb');
//         if (!response.ok) throw new Error('Failed to fetch notebook');
//         console.log('response', response)
//         const notebookHierarchized: any = await response.json();
//         console.log('notebook response:', notebookHierarchized);
        
//         const treeItems = convertToTreeViewItems(notebookHierarchized.data);
//         console.log('tree items', treeItems);
//         setLabels(treeItems);
//       } catch (error) {
//         console.error('Error fetching notebook:', error);
//       }
//     };

//     fetchNotebook();
//   }, []); // dependency array so only runs once on mount

//   return (
//     <Box sx={{ minHeight: 352, minWidth: 250 }}>
//       {labels.length > 0 ? (
//         <RichTreeView 
//         items={labels} 
//         sx={{
//           '& .MuiTreeItem-label': {
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

const MUI_X_PRODUCTS: TreeViewBaseItem[] = [
  {
    id: 'grid',
    label: 'Data Grid',
    children: [
      { id: 'grid-community', label: '@mui/x-data-grid' },
      { id: 'grid-pro', label: '@mui/x-data-grid-pro' },
      { id: 'grid-premium', label: '@mui/x-data-grid-premium' },
    ],
  },
  {
    id: 'pickers',
    label: 'Date and Time Pickers',
    children: [
      { id: 'pickers-community', label: '@mui/x-date-pickers' },
      { id: 'pickers-pro', label: '@mui/x-date-pickers-pro' },
    ],
  },
  {
    id: 'charts',
    label: 'Charts',
    children: [{ id: 'charts-community', label: '@mui/x-charts' }],
  },
  {
    id: 'tree-view',
    label: 'Tree View',
    children: [{ id: 'tree-view-community', label: '@mui/x-tree-view' }],
  },
];

export default function BasicRichTreeView() {
  return (
    <Box sx={{ minHeight: 352, minWidth: 250 }}>
      <RichTreeView items={MUI_X_PRODUCTS} />
    </Box>
  );
}