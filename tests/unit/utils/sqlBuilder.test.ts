import { describe, it, expect } from 'vitest';
import { buildUpdateQuery, buildInsertQuery, getInsertId, getAffectedRows } from '@/utils/sqlBuilder';

describe('buildUpdateQuery', () => {
  it('builds a simple UPDATE query', () => {
    const result = buildUpdateQuery(
      'users',
      { name: '张三', email: 'zhang@test.com' },
      'id = ?',
      [1]
    );
    expect(result.query).toBe('UPDATE users SET name = ?, email = ? WHERE id = ?');
    expect(result.params).toEqual(['张三', 'zhang@test.com', 1]);
  });

  it('filters out undefined values', () => {
    const result = buildUpdateQuery(
      'users',
      { name: '张三', email: undefined, role: undefined },
      'id = ?',
      [1]
    );
    expect(result.query).toBe('UPDATE users SET name = ? WHERE id = ?');
    expect(result.params).toEqual(['张三', 1]);
  });

  it('throws when no fields to update', () => {
    expect(() =>
      buildUpdateQuery('users', { name: undefined }, 'id = ?', [1])
    ).toThrow("No fields to update in table 'users'");
  });
});

describe('buildInsertQuery', () => {
  it('builds INSERT query with fields and placeholders', () => {
    const result = buildInsertQuery('users', {
      name: '李四',
      role: 'teacher',
    });
    expect(result.query).toBe('INSERT INTO users (name, role) VALUES (?, ?)');
    expect(result.params).toEqual(['李四', 'teacher']);
    expect(result.fields).toEqual(['name', 'role']);
    expect(result.placeholders).toEqual(['?', '?']);
  });

  it('skips undefined fields', () => {
    const result = buildInsertQuery('users', {
      name: '王五',
      email: undefined,
    });
    expect(result.query).toBe('INSERT INTO users (name) VALUES (?)');
    expect(result.params).toEqual(['王五']);
  });
});

describe('getInsertId', () => {
  it('extracts insertId from mysql result', () => {
    expect(getInsertId({ insertId: 42 })).toBe(42);
  });
});

describe('getAffectedRows', () => {
  it('extracts affectedRows from mysql result', () => {
    expect(getAffectedRows({ affectedRows: 5 })).toBe(5);
  });
});
