import { PASSWORD_MIN_LENGTH } from '../../shared/constants';

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validateRequired(value: string, label = 'This field'): ValidationResult {
  if (!value || !value.trim()) return { valid: false, message: `${label} is required` };
  return { valid: true };
}

export function validateEmail(email: string): ValidationResult {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return { valid: true }; // optional
  if (!re.test(email)) return { valid: false, message: 'Invalid email address' };
  return { valid: true };
}

export function validateMinLength(value: string, min: number, label = 'Value'): ValidationResult {
  if (value.length < min) return { valid: false, message: `${label} must be at least ${min} characters` };
  return { valid: true };
}

export interface StrengthResult {
  score: number;      // 0–4
  label: string;
  color: string;
  width: string;
}

export function passwordStrength(password: string): StrengthResult {
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  score = Math.min(score, 4);

  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#DC2626', '#D97706', '#EAB308', '#10B981', '#059669'];
  return {
    score,
    label: labels[score],
    color: colors[score],
    width: `${(score / 4) * 100}%`,
  };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) return { valid: false, message: 'Password is required' };
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }
  return { valid: true };
}

export function validatePositiveNumber(value: string, label = 'Value'): ValidationResult {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) return { valid: false, message: `${label} must be a positive number` };
  return { valid: true };
}

export function validateDate(dateStr: string, label = 'Date'): ValidationResult {
  if (!dateStr) return { valid: false, message: `${label} is required` };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { valid: false, message: `${label} is invalid` };
  return { valid: true };
}

export function showFieldError(input: HTMLInputElement | HTMLTextAreaElement | null, message: string): void {
  if (!input) return;
  input.classList.add('error');
  const err = input.parentElement?.querySelector('.form-error');
  if (err) err.textContent = message;
}

export function clearFieldError(input: HTMLInputElement | HTMLTextAreaElement | null): void {
  if (!input) return;
  input.classList.remove('error');
  const err = input.parentElement?.querySelector('.form-error');
  if (err) err.textContent = '';
}
