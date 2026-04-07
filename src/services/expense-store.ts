import path from 'path';
import fs from 'fs';
import { ApiResponse, Expense } from '../shared/types';
import { generateId } from '../shared/utils';

// Allow tests to override the base data directory (instead of app.getPath('userData'))
let _userDataOverride: string | null = null;

export function _setUserDataPath(p: string | null): void {
  _userDataOverride = p;
}

function getUserData(): string {
  if (_userDataOverride !== null) return _userDataOverride;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app } = require('electron') as typeof import('electron');
  return app.getPath('userData');
}

function userDir(userId: string): string {
  const dir = path.join(getUserData(), 'users', userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function expPath(userId: string): string {
  return path.join(userDir(userId), 'expenses.json');
}

function readJson<T>(filePath: string, defaultData: T): T {
  if (!fs.existsSync(filePath)) return defaultData;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return defaultData;
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadExpenses(userId: string): Expense[] {
  return readJson<{ expenses: Expense[] }>(expPath(userId), { expenses: [] }).expenses;
}

function saveExpenses(userId: string, expenses: Expense[]): void {
  writeJson(expPath(userId), { expenses });
}

function isValidExpense(data: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): string | null {
  if (typeof data.amount !== 'number' || data.amount < 0) {
    return 'amount must be a non-negative number';
  }
  if (!data.category || !data.category.trim()) {
    return 'category must be non-empty';
  }
  if (!data.description || !data.description.trim()) {
    return 'description must be non-empty';
  }
  if (!data.date || !data.date.trim()) {
    return 'date must be present';
  }
  return null;
}

export function createExpense(
  userId: string,
  data: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): ApiResponse<Expense> {
  try {
    const validationError = isValidExpense(data);
    if (validationError) {
      return { success: false, error: validationError };
    }
    const expenses = loadExpenses(userId);
    const now = new Date().toISOString();
    const expense: Expense = {
      id: generateId(),
      userId,
      date: data.date,
      amount: data.amount,
      category: data.category,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    };
    expenses.push(expense);
    saveExpenses(userId, expenses);
    return { success: true, data: expense };
  } catch (err) {
    return { success: false, error: `Failed to create expense: ${String(err)}` };
  }
}

export function updateExpense(
  userId: string,
  id: string,
  data: Partial<Expense>,
): ApiResponse<Expense> {
  try {
    const expenses = loadExpenses(userId);
    const idx = expenses.findIndex(e => e.id === id);
    if (idx === -1) return { success: false, error: 'Expense not found' };
    expenses[idx] = {
      ...expenses[idx],
      ...data,
      id,
      userId,
      updatedAt: new Date().toISOString(),
    };
    saveExpenses(userId, expenses);
    return { success: true, data: expenses[idx] };
  } catch (err) {
    return { success: false, error: `Failed to update expense: ${String(err)}` };
  }
}

export function deleteExpense(userId: string, id: string): ApiResponse {
  try {
    const expenses = loadExpenses(userId);
    const filtered = expenses.filter(e => e.id !== id);
    if (filtered.length === expenses.length) {
      return { success: false, error: 'Expense not found' };
    }
    saveExpenses(userId, filtered);
    return { success: true };
  } catch (err) {
    return { success: false, error: `Failed to delete expense: ${String(err)}` };
  }
}

export function getAllExpenses(userId: string): ApiResponse<Expense[]> {
  try {
    return { success: true, data: loadExpenses(userId) };
  } catch (err) {
    return { success: false, error: `Failed to load expenses: ${String(err)}` };
  }
}
