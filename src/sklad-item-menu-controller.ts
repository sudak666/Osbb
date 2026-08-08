export type SkladItemAction = (itemId: number, trigger: HTMLElement) => void;
export declare function createSkladItemMenuController(options: {
  document: Document; window: Window; actions: Record<string, SkladItemAction>;
}): { bind(): void; closeAll(except?: HTMLElement | null): void; position(menu: HTMLElement): void; reposition(): void; setExpanded(menu: HTMLElement, expanded: boolean): void };
