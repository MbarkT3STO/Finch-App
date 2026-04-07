import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import log from 'electron-log';
import { User, Session, ApiResponse } from '../shared/types';
import { SESSION_DURATION_DAYS } from '../shared/constants';
import { generateId } from '../shared/utils';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  encryptData,
  decryptData,
} from './encryption-service';

function usersFilePath(): string {
  return path.join(app.getPath('userData'), 'users.json');
}
function sessionFilePath(): string {
  return path.join(app.getPath('userData'), 'session.enc');
}
function userDataDir(userId: string): string {
  const dir = path.join(app.getPath('userData'), 'users', userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadUsers(): User[] {
  const p = usersFilePath();
  if (!fs.existsSync(p)) return [];
  try {
    return (JSON.parse(fs.readFileSync(p, 'utf8')).users as User[]) || [];
  } catch {
    return [];
  }
}
function saveUsers(users: User[]): void {
  fs.writeFileSync(usersFilePath(), JSON.stringify({ users }, null, 2));
}

// ─── Register ─────────────────────────────────────────────────────────────────
export async function registerUser(
  username: string,
  email: string | undefined,
  password: string,
): Promise<ApiResponse<{ userId: string; username: string }>> {
  try {
    const users = loadUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, error: 'Username already taken' };
    }
    if (email && users.find(u => u.email === email)) {
      return { success: false, error: 'Email already registered' };
    }
    const { hash, salt } = await hashPassword(password);
    const now = new Date().toISOString();
    const user: User = { id: generateId(), username, email, hash, salt, createdAt: now, lastLogin: now };
    users.push(user);
    saveUsers(users);
    userDataDir(user.id);
    log.info(`Registered: ${username}`);
    return { success: true, data: { userId: user.id, username: user.username } };
  } catch (err) {
    log.error('Register error:', err);
    return { success: false, error: 'Registration failed' };
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function loginUser(
  username: string,
  password: string,
): Promise<ApiResponse<Session>> {
  try {
    const users = loadUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { success: false, error: 'Invalid username or password' };
    const valid = await verifyPassword(password, user.hash, user.salt);
    if (!valid) return { success: false, error: 'Invalid username or password' };

    user.lastLogin = new Date().toISOString();
    saveUsers(users);
    userDataDir(user.id);

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + SESSION_DURATION_DAYS);
    const session: Session = {
      userId: user.id,
      username: user.username,
      token: generateToken(),
      expiresAt: expiry.toISOString(),
    };
    fs.writeFileSync(sessionFilePath(), encryptData(JSON.stringify(session)));
    log.info(`Login: ${username}`);
    return { success: true, data: session };
  } catch (err) {
    log.error('Login error:', err);
    return { success: false, error: 'Login failed' };
  }
}

// ─── Session ──────────────────────────────────────────────────────────────────
export function getSession(): ApiResponse<Session> {
  try {
    const p = sessionFilePath();
    if (!fs.existsSync(p)) return { success: false, error: 'No session' };
    const session: Session = JSON.parse(decryptData(fs.readFileSync(p, 'utf8')));
    if (new Date(session.expiresAt) < new Date()) {
      fs.unlinkSync(p);
      return { success: false, error: 'Session expired' };
    }
    return { success: true, data: session };
  } catch {
    return { success: false, error: 'Invalid session' };
  }
}

export function logoutUser(): ApiResponse {
  try {
    const p = sessionFilePath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { success: true };
  } catch {
    return { success: false, error: 'Logout failed' };
  }
}

// ─── Account management ───────────────────────────────────────────────────────
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ApiResponse> {
  try {
    const users = loadUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'User not found' };
    const valid = await verifyPassword(currentPassword, user.hash, user.salt);
    if (!valid) return { success: false, error: 'Current password is incorrect' };
    const { hash, salt } = await hashPassword(newPassword);
    user.hash = hash;
    user.salt = salt;
    saveUsers(users);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to change password' };
  }
}

export async function deleteAccount(userId: string, password: string): Promise<ApiResponse> {
  try {
    const users = loadUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'User not found' };
    const valid = await verifyPassword(password, user.hash, user.salt);
    if (!valid) return { success: false, error: 'Password is incorrect' };
    const dir = path.join(app.getPath('userData'), 'users', userId);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    saveUsers(users.filter(u => u.id !== userId));
    logoutUser();
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete account' };
  }
}
