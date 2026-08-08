import { escapeHtml } from './app-security.js';
import { calculateAuditSummary, createAuditData, parseAuditQuantity } from './sklad-audit.js';
import { numericIdFromInsertResponse } from './supabase-api.js';

void escapeHtml;
void calculateAuditSummary;
void createAuditData;
void parseAuditQuantity;
void numericIdFromInsertResponse;

export type SkladAuditControllerOptions = {
  db: unknown;
  document: Document;
  getItems(): unknown[];
  [key: string]: unknown;
};

export declare function createSkladAuditController(options: SkladAuditControllerOptions): {
  clear(itemId: number): void;
  confirm(): Promise<void>;
  fillCurrent(): void;
  fillZeros(): void;
  init(): void;
  input(itemId: number, value: string): void;
  openConfirm(): void;
  render(): void;
};
