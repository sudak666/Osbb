import { normalizeSearchText } from './sklad-domain.js';
void normalizeSearchText;
export declare function createSkladItemCrudController(options: Record<string, unknown>): {
  confirmDelete(): Promise<void>; openDelete(id: number): void; openEdit(id: number): void; saveEdit(button: HTMLButtonElement): Promise<void>;
};
