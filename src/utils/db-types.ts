import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export type { RowDataPacket, ResultSetHeader };
export type DbRow = RowDataPacket;
export type DbRows = RowDataPacket[];
export type DbResult = ResultSetHeader;

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

export function isDuplicateEntry(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as { code: string }).code === 'ER_DUP_ENTRY';
}
