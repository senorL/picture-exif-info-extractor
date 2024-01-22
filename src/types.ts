import { FieldType } from "@lark-base-open/js-sdk";

export interface ExifData {
  [key: string]: string | number;
}

export interface Field {
  id: string;
  name: string;
  type: FieldType;
}

export interface FieldMapping {
  [key: string]: string;
}

export interface CellValueItem {
  token: string;
}