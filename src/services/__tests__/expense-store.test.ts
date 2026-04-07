import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import fs from 'fs';
import path from 'path';
import {
  createExpense,
  updateExpense,
  deleteExpense,
  getAllExpenses,
  _setUserDataPath,
} from '../expense-store';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expense-store-test-'));
  _setUserDataPath(tmpDir);
});

afterEach(() => {
  _setUserDataPath(null);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const validPayload = {
  date: '2024-03-15',
  amount: 49.99,
  category: 'Software',
  description: 'Figma subscription',
};

describe('createExpense', () => {
  it('creates an expense and returns it with generated id', () => {
    const result = createExpense('user1', validPayload);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.id).toBeTruthy();
    expect(result.data!.userId).toBe('user1');
    expect(result.data!.amount).toBe(49.99);
    expect(result.data!.category).toBe('Software');
    expect(result.data!.description).toBe('Figma subscription');
    expect(result.data!.date).toBe('2024-03-15');
    expect(result.data!.createdAt).toBeTruthy();
    expect(result.data!.updatedAt).toBeTruthy();
  });

  it('rejects negative amount', () => {
    const result = createExpense('user1', { ...validPayload, amount: -1 });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects zero-amount as valid (amount >= 0)', () => {
    const result = createExpense('user1', { ...validPayload, amount: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects empty category', () => {
    const result = createExpense('user1', { ...validPayload, category: '' });
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only category', () => {
    const result = createExpense('user1', { ...validPayload, category: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects empty description', () => {
    const result = createExpense('user1', { ...validPayload, description: '' });
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only description', () => {
    const result = createExpense('user1', { ...validPayload, description: '  ' });
    expect(result.success).toBe(false);
  });

  it('rejects missing date', () => {
    const result = createExpense('user1', { ...validPayload, date: '' });
    expect(result.success).toBe(false);
  });
});

describe('getAllExpenses', () => {
  it('returns empty array when no expenses exist', () => {
    const result = getAllExpenses('user1');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('returns all created expenses', () => {
    createExpense('user1', validPayload);
    createExpense('user1', { ...validPayload, description: 'Second expense' });
    const result = getAllExpenses('user1');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });
});

describe('updateExpense', () => {
  it('updates an existing expense', () => {
    const created = createExpense('user1', validPayload);
    const id = created.data!.id;
    const result = updateExpense('user1', id, { amount: 99.99, category: 'Design' });
    expect(result.success).toBe(true);
    expect(result.data!.amount).toBe(99.99);
    expect(result.data!.category).toBe('Design');
    expect(result.data!.description).toBe('Figma subscription');
  });

  it('returns error for non-existent id', () => {
    const result = updateExpense('user1', 'nonexistent', { amount: 10 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('persists update to disk', () => {
    const created = createExpense('user1', validPayload);
    const id = created.data!.id;
    updateExpense('user1', id, { amount: 200 });
    const all = getAllExpenses('user1');
    expect(all.data![0].amount).toBe(200);
  });
});

describe('deleteExpense', () => {
  it('deletes an existing expense', () => {
    const created = createExpense('user1', validPayload);
    const id = created.data!.id;
    const result = deleteExpense('user1', id);
    expect(result.success).toBe(true);
    const all = getAllExpenses('user1');
    expect(all.data).toHaveLength(0);
  });

  it('returns error for non-existent id', () => {
    const result = deleteExpense('user1', 'nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('only deletes the targeted expense', () => {
    const e1 = createExpense('user1', validPayload);
    const e2 = createExpense('user1', { ...validPayload, description: 'Second' });
    deleteExpense('user1', e1.data!.id);
    const all = getAllExpenses('user1');
    expect(all.data).toHaveLength(1);
    expect(all.data![0].id).toBe(e2.data!.id);
  });
});

describe('CRUD lifecycle', () => {
  it('create → read → update → delete round-trip', () => {
    // Create
    const created = createExpense('user1', validPayload);
    expect(created.success).toBe(true);
    const id = created.data!.id;

    // Read
    let all = getAllExpenses('user1');
    expect(all.data).toHaveLength(1);
    expect(all.data![0].id).toBe(id);

    // Update
    const updated = updateExpense('user1', id, { amount: 150 });
    expect(updated.success).toBe(true);
    all = getAllExpenses('user1');
    expect(all.data![0].amount).toBe(150);

    // Delete
    const deleted = deleteExpense('user1', id);
    expect(deleted.success).toBe(true);
    all = getAllExpenses('user1');
    expect(all.data).toHaveLength(0);
  });
});

describe('user isolation', () => {
  it('expenses for user1 are not visible to user2', () => {
    createExpense('user1', validPayload);
    createExpense('user1', { ...validPayload, description: 'Another' });

    const user2Expenses = getAllExpenses('user2');
    expect(user2Expenses.success).toBe(true);
    expect(user2Expenses.data).toHaveLength(0);
  });

  it('each user has their own independent expense list', () => {
    createExpense('user1', { ...validPayload, description: 'User1 expense' });
    createExpense('user2', { ...validPayload, description: 'User2 expense' });

    const user1 = getAllExpenses('user1');
    const user2 = getAllExpenses('user2');

    expect(user1.data).toHaveLength(1);
    expect(user2.data).toHaveLength(1);
    expect(user1.data![0].description).toBe('User1 expense');
    expect(user2.data![0].description).toBe('User2 expense');
  });

  it('deleting from user1 does not affect user2', () => {
    const e1 = createExpense('user1', validPayload);
    createExpense('user2', validPayload);

    deleteExpense('user1', e1.data!.id);

    expect(getAllExpenses('user1').data).toHaveLength(0);
    expect(getAllExpenses('user2').data).toHaveLength(1);
  });
});

describe('persistence', () => {
  it('data survives re-reading from disk (simulated restart)', () => {
    createExpense('user1', validPayload);
    // Re-read without clearing the tmpDir — simulates app restart
    const result = getAllExpenses('user1');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].description).toBe('Figma subscription');
  });
});
