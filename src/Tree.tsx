import * as React from 'react';
import Box from '@mui/material/Box';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import vscode from './vscodeApi';
import { TreeItem2, TreeItem2Props } from '@mui/x-tree-view/TreeItem2';
// import Narrative from './Narrative';
import { useTreeItem2Utils } from '@mui/x-tree-view/hooks';

// Parse the first cell number from a cell reference string
// export function parseFirstCellNumber(cellsString: string): number | null {
//   // Use regex to find the first number in the string
//   const match = cellsString.match(/\d+/);
//   if (match) {
//     return parseInt(match[0], 10);
//   }
//   return null;
// }

// custom NarrativeLabel component with formatted links
interface NarrativeLabelProps {
  sentence: string;
  className: string;
}

function NarrativeLabel({ sentence, className }: NarrativeLabelProps) {
  // Parse the sentence to extract text parts and references
  const parseTechDoc = (text = '') => {
    const references: any[] = [];
    const sections: string[] = [];
    let lastIndex = 0;

    // take commas or dashes
    const pattern = /\{"([^"}]+)"}\[cell\s*(\d+(?:[-,]\d+)*)\]/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      sections.push(text.slice(lastIndex, match.index));

      // parse for numbers
      const rawCells = match[2].trim();
      let cellList: number[];
      if (rawCells.includes('-')) {
        const [start, end] = rawCells.split('-').map(Number);
        cellList = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      } else {
        cellList = rawCells.split(',').map((n) => parseInt(n.trim(), 10));
      }

      const firstCell = cellList[0];
      references.push({
        content: match[1].trim(),
        cell: firstCell,
      });

      lastIndex = pattern.lastIndex;
    }

    sections.push(text.slice(lastIndex));
    return { parts: sections, references };
  };

  // handle cell reference click for direct manipulation
  // under command `selectCell`
  const handleCellClick = (cellIndex: number) => {
    // const cellIndex = parseFirstCellNumber(cellsInfo);
    // if (cellIndex !== null) {
    console.log('Cell reference clicked:', cellIndex);
    vscode?.postMessage({ type: 'selectCell', index: cellIndex });
    // }
  };

  // Render the content with formatted links
  const renderContent = () => {
    const { parts, references } = parseTechDoc(sentence);

    return parts.map((section, index) => (
      <React.Fragment key={index}>
        {section}
        {index < references.length && (
          <span
            onClick={() => handleCellClick(references[index].cell)}
            style={{ color: '#f0acb4', cursor: 'pointer' }}
          >
            {references[index].content.replace(/^['"]|['"]$/g, '')}
          </span>
        )}
      </React.Fragment>
    ));
  };

  return <span className={className}>{renderContent()}</span>;
}

// Interface to extend TreeItem with custom data
interface CustomItemData {
  isNarrative?: boolean;
  sentence?: string;
}

// Custom TreeItem component that conditionally renders different label types
const CustomTreeItem = React.forwardRef(function CustomTreeItem(
  props: TreeItem2Props,
  ref: React.Ref<HTMLLIElement>
) {
  const { publicAPI } = useTreeItem2Utils({
    itemId: props.itemId,
    children: props.children,
  });

  const item = publicAPI.getItem(props.itemId) as TreeViewBaseItem &
    CustomItemData;
  // if narrative node, use custom NarrativeLabel component for the label
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
  // else use the default label rendering
  return <TreeItem2 {...props} ref={ref} />;
});

// helper conversion function to map LLM generated groups to tree items
// with custom conversion for the in line textual summaries as optional leaf nodes
const convertToTreeViewItems = (
  json: any,
  narrativeMapping: { [cell: number]: string[] },
  parentId = ''
): TreeViewBaseItem[] => {
  const seenSentences = new Set<string>();

  return json.groups.map((group: any, groupIndex: number) => {
    const groupId = `${parentId}group-${groupIndex}`;
    return {
      id: groupId,
      label: group.name, // Basic string label for groups
      children: group.subgroups.map((subgroup: any, subgroupIndex: number) => {
        const subgroupId = `${groupId}-subgroup-${subgroupIndex}`;
        // Create narrative items with custom data
        const subgroupSentences: (TreeViewBaseItem & CustomItemData)[] =
          subgroup.cells.flatMap((cell: number) => {
            return (narrativeMapping[cell] || [])
              .filter((sentence) => {
                if (seenSentences.has(sentence)) return false;
                seenSentences.add(sentence);
                return true;
              })
              .map((sentence, i) => ({
                id: `${subgroupId}-narrative-${cell}-${i}`,
                label: sentence,
                cellIndex: cell,
                isNarrative: true,
                sentence,
              }));
          });

        return {
          id: subgroupId,
          label: subgroup.name,
          children: subgroupSentences,
        };
      }),
    };
  });
};

// helper function to grab every node that's a narrative + their parents
function collectExpandableIds(
  items: (TreeViewBaseItem & CustomItemData)[]
): string[] {
  const parents = new Set<string>();

  function walk(nodes: (TreeViewBaseItem & CustomItemData)[], path: string[]) {
    for (const node of nodes) {
      const myPath = [...path, node.id];
      if (node.isNarrative) {
        for (let i = 0; i < path.length; i++) {
          parents.add(path[i]);
        }
      }
      if (node.children) {
        walk(node.children as any, myPath);
      }
    }
  }
  walk(items, []);
  return Array.from(parents);
}

export default function BasicRichTreeView({
  data,
  narrativeMapping,
}: {
  data: any;
  narrativeMapping: { [cell: number]: string[] };
}) {
  console.log('narrative mapping', narrativeMapping);

  // 2.1. convert tree items
  const items = React.useMemo(
    () => convertToTreeViewItems(data, narrativeMapping),
    [data, narrativeMapping]
  );
  console.log('converted items', items);

  // 2.2. setting expanded IDs to any narrative nodes + their parents
  const [expandedIds, setExpandedIds] = React.useState<string[]>(() =>
    collectExpandableIds(items)
  );

  // 2.3. dynamically recomputing changes in tree nodes for auto-expansion
  React.useEffect(() => {
    setExpandedIds(collectExpandableIds(items));
  }, [items]);

  const handleNodeSelect = (event: React.SyntheticEvent, nodeId: string) => {
    if (nodeId.includes('narrative')) {
      // Extract the cell index from the nodeId
      const match = nodeId.match(/-narrative-(\d+)-/);
      if (match && match[1]) {
        const cellIndex = parseInt(match[1], 10);
        console.log('selected cell index', cellIndex);
        // Post the selected cell index to the VSCode extension
        vscode?.postMessage({ type: 'selectCell', index: cellIndex });
      }
    }
  };

  console.log('expanded', expandedIds);

  return (
    <Box sx={{ minWidth: 250 }}>
      {items.length > 0 ? (
        <RichTreeView
          items={items}
          expandedItems={expandedIds}
          onExpandedItemsChange={(event, newIds) => {
            setExpandedIds(newIds);
          }}
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
        <p className="loading-text">Loading notebook data…</p>
      )}
    </Box>
  );
}

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
