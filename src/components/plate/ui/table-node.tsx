"use client";

import { useDraggable, useDropLine } from "@platejs/dnd";
import {
  BlockSelectionPlugin,
  useBlockSelected,
} from "@platejs/selection/react";
import { isSelectingCell, setCellBackground } from "@platejs/table";
import {
  TablePlugin,
  TableProvider,
  useTableBordersDropdownMenuContentState,
  useTableCellElement,
  useTableCellElementResizable,
  useTableElement,
  useTableMergeState,
} from "@platejs/table/react";
import type * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { PopoverAnchor } from "@radix-ui/react-popover";
import {
  ArrowDown,
  ArrowUp,
  CombineIcon,
  EraserIcon,
  Grid2X2Icon,
  GripVertical,
  PaintBucketIcon,
  Plus,
  SquareSplitHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import {
  ElementApi,
  KEYS,
  PathApi,
  type Path,
  type TTableCellElement,
  type TTableElement,
  type TTableRowElement,
} from "platejs";
import {
  PlateElement,
  useEditorPlugin,
  useEditorRef,
  useEditorSelector,
  useElement,
  useElementSelector,
  usePluginOption,
  useReadOnly,
  useRemoveNodeButton,
  useSelected,
  withHOC,
  type PlateElementProps,
} from "platejs/react";
import * as React from "react";

import { Button } from "@/components/plate/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/plate/ui/dropdown-menu";
import { Popover, PopoverContent } from "@/components/plate/ui/popover";
import { cn } from "@/lib/utils";
import { blockSelectionVariants } from "./block-selection";
import { ColorDropdownMenuItems, DEFAULT_COLORS } from "./font-color-toolbar-button";
import { ResizeHandle } from "./resize-handle";
import {
  BorderAllIcon,
  BorderBottomIcon,
  BorderLeftIcon,
  BorderNoneIcon,
  BorderRightIcon,
  BorderTopIcon,
} from "./table-icons";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarMenuGroup,
} from "./toolbar";

function setRefValue<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref) {
    ref.current = value;
  }
}

function getLastTableRowPath(
  tableElement: TTableElement,
  tablePath: Path,
): Path | undefined {
  if (tableElement.children.length === 0) return undefined;

  return [...tablePath, tableElement.children.length - 1];
}

function getLastTableCellPath(
  tableElement: TTableElement,
  tablePath: Path,
): Path | undefined {
  for (
    let rowIndex = tableElement.children.length - 1;
    rowIndex >= 0;
    rowIndex -= 1
  ) {
    const row = tableElement.children[rowIndex];

    if (!ElementApi.isElement(row)) continue;

    if (row.children.length > 0) {
      return [...tablePath, rowIndex, row.children.length - 1];
    }
  }

  return undefined;
}

export const TableElement = withHOC(
  TableProvider,
  function TableElement({
    children,
    ...props
  }: PlateElementProps<TTableElement>) {
    const editor = useEditorRef();
    const { tf } = useEditorPlugin(TablePlugin);
    const readOnly = useReadOnly();
    const isSelectionAreaVisible = usePluginOption(
      BlockSelectionPlugin,
      "isSelectionAreaVisible",
    );
    const hasControls = !readOnly && !isSelectionAreaVisible;
    const selected = useSelected();
    const { marginLeft, props: tableProps } = useTableElement();
    const isSelectingCells = isSelectingCell(props.editor);
    const tableId = props.element.id;
    const isTableBlockSelected = useBlockSelected(
      typeof tableId === "string" ? tableId : undefined,
    );
    const isSelectionInCurrentTable = useEditorSelector(
      (currentEditor) => {
        const tableEntry = currentEditor.api.above({
          match: { type: KEYS.table },
        });
        const [selectedTable] = tableEntry ?? [];

        return typeof tableId === "string" && selectedTable?.id === tableId;
      },
      [tableId],
    );
    const showTableGrowthControls =
      hasControls && (isTableBlockSelected || isSelectionInCurrentTable);

    const colSizes = props.element.colSizes ?? [];

    const insertColumnAfter = React.useCallback(() => {
      const tablePath = editor.api.findPath(props.element);
      if (!tablePath) return;

      const fromCell = getLastTableCellPath(props.element, tablePath);
      if (!fromCell) return;

      tf.insert.tableColumn({ fromCell, select: true });
      editor.tf.focus();
    }, [editor, props.element, tf]);

    const insertRowAfter = React.useCallback(() => {
      const tablePath = editor.api.findPath(props.element);
      if (!tablePath) return;

      const fromRow = getLastTableRowPath(props.element, tablePath);
      if (!fromRow) return;

      tf.insert.tableRow({ fromRow, select: true });
      editor.tf.focus();
    }, [editor, props.element, tf]);

    const content = (
      <PlateElement
        {...props}
        className={cn(
          "overflow-x-auto py-5",
          hasControls && "-ml-2 data-[slot=block-selection]:*:left-2",
        )}
        style={{ paddingLeft: marginLeft }}
      >
        <div
          className={cn(
            "group/table relative w-full bg-transparent",
            showTableGrowthControls &&
              "grid grid-cols-[minmax(0,1fr)_1.25rem] grid-rows-[auto_1.25rem]",
          )}
        >
          {isTableBlockSelected && (
            <div className={blockSelectionVariants()} contentEditable={false} />
          )}
          <table
            className={cn(
              "mr-0 ml-px table h-px max-w-full table-fixed border-collapse bg-transparent text-(--presentation-text)",
              isSelectingCells && "selection:bg-transparent",
              colSizes.length > 0 && colSizes.every((size) => size !== 0)
                ? "w-fit"
                : "w-full",
            )}
            {...tableProps}
          >
            <tbody className="w-full">{children}</tbody>
          </table>
          {showTableGrowthControls && (
            <>
              <Button
                aria-label="Add column"
                className={cn(
                  "z-40 h-full min-h-10 w-5 rounded-md border-border/80 bg-muted/80 p-0 text-muted-foreground shadow-xs backdrop-blur-sm",
                  "transition-colors duration-100 hover:bg-background hover:text-foreground",
                )}
                contentEditable={false}
                onClick={insertColumnAfter}
                onMouseDown={(event) => event.preventDefault()}
                size="icon"
                title="Add column"
                type="button"
                variant="outline"
              >
                <Plus className="size-3.5" data-ppt-ignore="true" />
              </Button>
              <Button
                aria-label="Add row"
                className={cn(
                  "z-40 col-span-2 h-5 w-auto rounded-md border-border/80 bg-muted/80 p-0 text-muted-foreground shadow-xs backdrop-blur-sm",
                  "transition-colors duration-100 hover:bg-background hover:text-foreground",
                )}
                contentEditable={false}
                onClick={insertRowAfter}
                onMouseDown={(event) => event.preventDefault()}
                size="icon"
                title="Add row"
                type="button"
                variant="outline"
              >
                <Plus className="size-3.5" data-ppt-ignore="true" />
              </Button>
            </>
          )}
        </div>
      </PlateElement>
    );

    if (readOnly || !selected) {
      return content;
    }

    return <TableFloatingToolbar>{content}</TableFloatingToolbar>;
  },
);

function TableFloatingToolbar({
  children,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  const { tf } = useEditorPlugin(TablePlugin);
  const element = useElement<TTableElement>();
  const { props: buttonProps } = useRemoveNodeButton({ element });
  const collapsed = useEditorSelector((editor) => !editor.api.isExpanded(), []);

  const { canMerge, canSplit } = useTableMergeState();

  return (
    <Popover open={canMerge || canSplit || collapsed} modal={false}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        asChild
        onOpenAutoFocus={(e) => e.preventDefault()}
        contentEditable={false}
        {...props}
      >
        <Toolbar
          className="scrollbar-hide flex w-auto max-w-[80vw] flex-row overflow-x-auto rounded-md border bg-popover p-1 shadow-md print:hidden"
          contentEditable={false}
        >
          <ToolbarGroup>
            <ColorDropdownMenu tooltip="Background color">
              <PaintBucketIcon />
            </ColorDropdownMenu>
            {canMerge && (
              <ToolbarButton
                onClick={() => tf.table.merge()}
                onMouseDown={(e) => e.preventDefault()}
                tooltip="Merge cells"
              >
                <CombineIcon />
              </ToolbarButton>
            )}
            {canSplit && (
              <ToolbarButton
                onClick={() => tf.table.split()}
                onMouseDown={(e) => e.preventDefault()}
                tooltip="Split cell"
              >
                <SquareSplitHorizontalIcon />
              </ToolbarButton>
            )}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <ToolbarButton tooltip="Cell borders">
                  <Grid2X2Icon />
                </ToolbarButton>
              </DropdownMenuTrigger>

              <DropdownMenuPortal>
                <TableBordersDropdownMenuContent />
              </DropdownMenuPortal>
            </DropdownMenu>

            {collapsed && (
              <ToolbarGroup>
                <ToolbarButton tooltip="Delete table" {...buttonProps}>
                  <Trash2Icon />
                </ToolbarButton>
              </ToolbarGroup>
            )}
          </ToolbarGroup>

          {collapsed && (
            <ToolbarGroup>
              <ToolbarButton
                onClick={() => {
                  tf.insert.tableRow({ before: true });
                }}
                onMouseDown={(e) => e.preventDefault()}
                tooltip="Insert row before"
              >
                <ArrowUp />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => {
                  tf.insert.tableRow();
                }}
                onMouseDown={(e) => e.preventDefault()}
                tooltip="Insert row after"
              >
                <ArrowDown />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => {
                  tf.remove.tableRow();
                }}
                onMouseDown={(e) => e.preventDefault()}
                tooltip="Delete row"
              >
                <XIcon />
              </ToolbarButton>
            </ToolbarGroup>
          )}

          {collapsed && (
            <ToolbarGroup>
              <ToolbarButton
                onClick={() => {
                  tf.remove.tableColumn();
                }}
                onMouseDown={(e) => e.preventDefault()}
                tooltip="Delete column"
              >
                <XIcon />
              </ToolbarButton>
            </ToolbarGroup>
          )}
        </Toolbar>
      </PopoverContent>
    </Popover>
  );
}

function TableBordersDropdownMenuContent(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Content>,
) {
  const editor = useEditorRef();
  const {
    getOnSelectTableBorder,
    hasBottomBorder,
    hasLeftBorder,
    hasNoBorders,
    hasOuterBorders,
    hasRightBorder,
    hasTopBorder,
  } = useTableBordersDropdownMenuContentState();

  return (
    <DropdownMenuContent
      className="min-w-55"
      onCloseAutoFocus={(e) => {
        e.preventDefault();
        editor.tf.focus();
      }}
      align="start"
      side="right"
      sideOffset={0}
      {...props}
    >
      <DropdownMenuGroup>
        <DropdownMenuCheckboxItem
          checked={hasTopBorder}
          onCheckedChange={getOnSelectTableBorder("top")}
        >
          <BorderTopIcon />
          <div>Top Border</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={hasRightBorder}
          onCheckedChange={getOnSelectTableBorder("right")}
        >
          <BorderRightIcon />
          <div>Right Border</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={hasBottomBorder}
          onCheckedChange={getOnSelectTableBorder("bottom")}
        >
          <BorderBottomIcon />
          <div>Bottom Border</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={hasLeftBorder}
          onCheckedChange={getOnSelectTableBorder("left")}
        >
          <BorderLeftIcon />
          <div>Left Border</div>
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>

      <DropdownMenuGroup>
        <DropdownMenuCheckboxItem
          checked={hasNoBorders}
          onCheckedChange={getOnSelectTableBorder("none")}
        >
          <BorderNoneIcon />
          <div>No Border</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={hasOuterBorders}
          onCheckedChange={getOnSelectTableBorder("outer")}
        >
          <BorderAllIcon />
          <div>Outside Borders</div>
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
}

function ColorDropdownMenu({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip: string;
}) {
  const [open, setOpen] = React.useState(false);

  const editor = useEditorRef();
  const selectedCells = usePluginOption(TablePlugin, "selectedCells");

  const onUpdateColor = React.useCallback(
    (color: string) => {
      setOpen(false);
      setCellBackground(editor, { color, selectedCells: selectedCells ?? [] });
    },
    [selectedCells, editor],
  );

  const onClearColor = React.useCallback(() => {
    setOpen(false);
    setCellBackground(editor, {
      color: null,
      selectedCells: selectedCells ?? [],
    });
  }, [selectedCells, editor]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton tooltip={tooltip}>{children}</ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <ToolbarMenuGroup label="Colors">
          <ColorDropdownMenuItems
            className="px-2"
            colors={DEFAULT_COLORS}
            updateColor={onUpdateColor}
          />
        </ToolbarMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuItem className="p-2" onClick={onClearColor}>
            <EraserIcon />
            <span>Clear</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TableRowElement(props: PlateElementProps<TTableRowElement>) {
  const { element } = props;
  const readOnly = useReadOnly();
  const editor = useEditorRef();
  const isSelectionAreaVisible = usePluginOption(
    BlockSelectionPlugin,
    "isSelectionAreaVisible",
  );
  const hasControls = !readOnly && !isSelectionAreaVisible;

  const { isDragging, previewRef, handleRef } = useDraggable({
    element,
    type: element.type,
    canDropNode: ({ dragEntry, dropEntry }) =>
      PathApi.equals(
        PathApi.parent(dragEntry[1]),
        PathApi.parent(dropEntry[1]),
      ),
    onDropHandler: (_, { dragItem }) => {
      const dragElement =
        "element" in dragItem && ElementApi.isElement(dragItem.element)
          ? dragItem.element
          : undefined;

      if (dragElement) {
        editor.tf.select(dragElement);
      }
    },
  });
  const rowRef = React.useCallback(
    (node: HTMLTableRowElement | null) => {
      setRefValue<HTMLElement>(props.ref, node);
      setRefValue<HTMLElement>(previewRef, node);
    },
    [previewRef, props.ref],
  );

  return (
    <PlateElement
      {...props}
      ref={rowRef}
      as="tr"
      className={cn("group/row", isDragging && "opacity-50")}
    >
      {hasControls && (
        <td className="w-2 select-none" contentEditable={false}>
          <RowDragHandle dragRef={handleRef} />
          <RowDropLine />
        </td>
      )}

      {props.children}
    </PlateElement>
  );
}

function RowDragHandle({ dragRef }: { dragRef: React.Ref<HTMLButtonElement> }) {
  const editor = useEditorRef();
  const element = useElement();

  return (
    <button
      ref={dragRef}
      type="button"
      className={cn(
        "absolute top-1/2 z-51 w-4 -translate-y-1/2 p-0.5 focus-visible:ring-0 focus-visible:ring-offset-0",
        "cursor-grab active:cursor-grabbing",
        'flex items-center rounded bg-accent opacity-0 outline transition-opacity duration-100 group-hover/row:opacity-100 group-has-data-[resizing="true"]/row:opacity-0',
      )}
      onClick={() => {
        editor.tf.select(element);
      }}
    >
      <GripVertical
        className="size-3.5 text-muted-foreground"
        data-ppt-ignore="true"
      />
    </button>
  );
}

function RowDropLine() {
  const { dropLine } = useDropLine();

  if (!dropLine) return null;

  return (
    <div
      className={cn(
        "absolute inset-x-0 left-2 z-50 h-0.5 rounded-full bg-brand/50",
        dropLine === "top" ? "-top-px" : "-bottom-px",
      )}
    />
  );
}

export function TableCellElement({
  isHeader,
  ...props
}: PlateElementProps<TTableCellElement> & {
  isHeader?: boolean;
}) {
  const { api } = useEditorPlugin(TablePlugin);
  const readOnly = useReadOnly();
  const element = props.element;

  const rowId = useElementSelector(([node]) => node.id as string, [], {
    key: KEYS.tr,
  });
  const isSelectingRow = useBlockSelected(rowId);
  const isSelectionAreaVisible = usePluginOption(
    BlockSelectionPlugin,
    "isSelectionAreaVisible",
  );
  const selectedCellIds = usePluginOption(TablePlugin, "selectedCellIds");

  const { borders, colIndex, colSpan, minHeight, rowIndex, selected, width } =
    useTableCellElement();
  const isCellSelected =
    selected ||
    (typeof element.id === "string" &&
      (selectedCellIds?.includes(element.id) ?? false));

  const { bottomProps, hiddenLeft, leftProps, rightProps } =
    useTableCellElementResizable({
      colIndex,
      colSpan,
      rowIndex,
    });

  return (
    <PlateElement
      {...props}
      as={isHeader ? "th" : "td"}
      className={cn(
        "relative h-full overflow-visible border-none bg-transparent p-0",
        isHeader && "text-left *:m-0",
        "before:inset-0 before:z-10 before:size-full",
        (isCellSelected || isSelectingRow) && "before:bg-brand/20",
        "before:absolute before:box-border before:content-[''] before:select-none",
        borders.bottom?.size && `before:border-b before:border-b-border`,
        borders.right?.size && `before:border-r before:border-r-border`,
        borders.left?.size && `before:border-l before:border-l-border`,
        borders.top?.size && `before:border-t before:border-t-border`,
      )}
      style={
        {
          "--cellBackground": element.background,
          maxWidth: width || 240,
          width: width || undefined,
          minWidth: width || 120,
          backgroundColor:
            element.background ??
            (isHeader ? "var(--presentation-card-background)" : undefined),
        } as React.CSSProperties
      }
      attributes={{
        ...props.attributes,
        colSpan: api.table.getColSpan(element),
        rowSpan: api.table.getRowSpan(element),
      }}
    >
      {(isCellSelected || isSelectingRow) && (
        <div
          className="pointer-events-none absolute inset-0 z-10 bg-brand/20"
          contentEditable={false}
        />
      )}

      <div
        className={cn(
          "relative z-20 box-border h-full rounded-md px-3 py-2",
          isHeader ? "text-lg font-bold text-primary" : "presentation-text",
        )}
        style={{ minHeight }}
      >
        {props.children}
      </div>

      {!isSelectionAreaVisible && (
        <div
          className="group absolute top-0 size-full select-none"
          contentEditable={false}
          suppressContentEditableWarning={true}
        >
          {!readOnly && (
            <>
              <ResizeHandle
                {...rightProps}
                className="-top-2 -right-1 h-[calc(100%+8px)] w-2"
                data-col={colIndex}
              />
              <ResizeHandle {...bottomProps} className="-bottom-1 h-2" />
              {!hiddenLeft && (
                <ResizeHandle
                  {...leftProps}
                  className="top-0 -left-1 w-2"
                  data-resizer-left={colIndex === 0 ? "true" : undefined}
                />
              )}

              <div
                className={cn(
                  "absolute top-0 z-30 hidden h-full w-1 bg-ring",
                  "right-[-1.5px]",
                  getColumnResizeClass(colIndex),
                )}
              />
              {colIndex === 0 && (
                <div
                  className={cn(
                    "absolute top-0 z-30 h-full w-1 bg-ring",
                    "left-[-1.5px]",
                    'hidden animate-in fade-in group-has-[[data-resizer-left]:hover]/table:block group-has-[[data-resizer-left][data-resizing="true"]]/table:block',
                  )}
                />
              )}
            </>
          )}
        </div>
      )}

      {isSelectingRow && (
        <div className={blockSelectionVariants()} contentEditable={false} />
      )}
    </PlateElement>
  );
}

export function TableCellHeaderElement(
  props: React.ComponentProps<typeof TableCellElement>,
) {
  return <TableCellElement {...props} isHeader />;
}

const COLUMN_RESIZE_CLASSES: Record<number, string> = {
  0: 'group-has-[[data-col="0"]:hover]/table:block group-has-[[data-col="0"][data-resizing="true"]]/table:block',
  1: 'group-has-[[data-col="1"]:hover]/table:block group-has-[[data-col="1"][data-resizing="true"]]/table:block',
  2: 'group-has-[[data-col="2"]:hover]/table:block group-has-[[data-col="2"][data-resizing="true"]]/table:block',
  3: 'group-has-[[data-col="3"]:hover]/table:block group-has-[[data-col="3"][data-resizing="true"]]/table:block',
  4: 'group-has-[[data-col="4"]:hover]/table:block group-has-[[data-col="4"][data-resizing="true"]]/table:block',
  5: 'group-has-[[data-col="5"]:hover]/table:block group-has-[[data-col="5"][data-resizing="true"]]/table:block',
  6: 'group-has-[[data-col="6"]:hover]/table:block group-has-[[data-col="6"][data-resizing="true"]]/table:block',
  7: 'group-has-[[data-col="7"]:hover]/table:block group-has-[[data-col="7"][data-resizing="true"]]/table:block',
  8: 'group-has-[[data-col="8"]:hover]/table:block group-has-[[data-col="8"][data-resizing="true"]]/table:block',
  9: 'group-has-[[data-col="9"]:hover]/table:block group-has-[[data-col="9"][data-resizing="true"]]/table:block',
  10: 'group-has-[[data-col="10"]:hover]/table:block group-has-[[data-col="10"][data-resizing="true"]]/table:block',
};

function getColumnResizeClass(colIndex: number) {
  return COLUMN_RESIZE_CLASSES[colIndex] ?? "";
}
