/**
 * SQL 动态构建辅助函数
 */

// SQL 参数支持的类型（mysql2 的 execute 方法接受这些类型）
export type SqlValue = string | number | boolean | null | undefined | Buffer;

/**
 * @deprecated 使用 SqlValue 代替
 */
export type UpdateValue = SqlValue;

/**
 * 构建动态 UPDATE 查询
 * @param table 表名
 * @param dto 包含要更新字段的对象，只更新 defined 的值
 * @param whereClause WHERE 条件（不含 WHERE 关键字）
 * @param whereParams WHERE 条件的参数
 */
export function buildUpdateQuery(
  table: string,
  dto: Record<string, UpdateValue>,
  whereClause: string,
  whereParams: UpdateValue[]
): { query: string; params: UpdateValue[] } {
  const entries = Object.entries(dto).filter(([, v]) => v !== undefined);

  if (entries.length === 0) {
    throw new Error(`No fields to update in table '${table}'`);
  }

  const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
  const params = [...entries.map(([, v]) => v), ...whereParams] as UpdateValue[];

  return {
    query: `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`,
    params
  };
}

/**
 * 构建动态 INSERT 查询
 * @param table 表名
 * @param dto 包含要插入字段的对象
 * @returns { query, params, fields, placeholders }
 */
export function buildInsertQuery(
  table: string,
  dto: Record<string, UpdateValue>
): { query: string; params: UpdateValue[]; fields: string[]; placeholders: string[] } {
  const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
  const fields = entries.map(([k]) => k);
  const placeholders = entries.map(() => '?');
  const params = entries.map(([, v]) => v) as UpdateValue[];

  return {
    query: `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
    params,
    fields,
    placeholders
  };
}

/**
 * 从查询结果中提取标量值
 */
export function getInsertId(result: unknown): number {
  return (result as { insertId: number }).insertId;
}

/**
 * 从查询结果中提取影响行数
 */
export function getAffectedRows(result: unknown): number {
  return (result as { affectedRows: number }).affectedRows;
}
