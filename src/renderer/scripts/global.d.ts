import type { FinchAPI } from '../../shared/types';

declare global {
  interface Window {
    finchAPI: FinchAPI;
  }
}

export {};
