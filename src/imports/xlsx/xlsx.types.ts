export interface CellPosition {
  row: number;
  col: number;
}

export interface SheetCellSnapshot extends CellPosition {
  address: string;
  value: string;
  valueType?: 'text' | 'number' | 'date';
  dateValue?: string;
}

export interface SheetMergeSnapshot {
  ref: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface SheetSnapshot {
  name: string;
  usedRange?: string;
  minRow: number;
  minCol: number;
  maxRow: number;
  maxCol: number;
  cells: SheetCellSnapshot[];
  merges: SheetMergeSnapshot[];
  hiddenRows?: number[];
  hiddenColumns?: number[];
}

export interface WorkbookSnapshot {
  sheetNames: string[];
  sheets: SheetSnapshot[];
}
