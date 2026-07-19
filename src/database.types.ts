export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
    public: {
        Tables: {
            inventory_items: {
                Row: {
                    id: number;
                    name: string;
                    category: string | null;
                    quantity: number;
                    unit: string;
                    min_quantity: number | null;
                    photo_url: string | null;
                    created_at: string;
                    updated_at: string | null;
                    is_internal: boolean;
                    price_unit: number | null;
                    price_source: string | null;
                    price_url: string | null;
                    price_checked_at: string | null;
                    price_confidence: string | null;
                };
            };
            inventory_logs: {
                Row: {
                    id: number;
                    item_id: number | null;
                    item_name: string;
                    qty: number;
                    unit: string | null;
                    person: string | null;
                    comment: string | null;
                    created_at: string;
                };
            };
            inventory_receipts: {
                Row: {
                    id: number;
                    item_id: number | null;
                    item_name: string;
                    qty: number;
                    unit: string | null;
                    person: string | null;
                    comment: string | null;
                    created_at: string;
                };
            };
            schedule: {
                Row: {
                    id: number;
                    date: string;
                    person: string | null;
                    is_done: boolean;
                    comment: string | null;
                    created_at: string;
                };
            };
            garbage: {
                Row: {
                    id: number;
                    date: string;
                    status: string | null;
                    comment: string | null;
                    created_at: string;
                };
            };
            dispatcher: {
                Row: {
                    id: number;
                    created_at: string;
                    author: string | null;
                    text: string;
                    is_done: boolean;
                };
            };
            chat: {
                Row: {
                    id: number;
                    created_at: string;
                    author: string | null;
                    text: string;
                };
            };
            photos: {
                Row: {
                    id: number;
                    created_at: string;
                    url: string;
                    path: string | null;
                    caption: string | null;
                };
            };
        };
        Functions: {
            verify_lock_pin: {
                Args: { attempt: string };
                Returns: boolean;
            };
            verify_reset_pin: {
                Args: { attempt: string };
                Returns: boolean;
            };
            reset_month: {
                Args: Record<string, never>;
                Returns: Json;
            };
            verify_pin: {
                Args: { attempt: string };
                Returns: boolean;
            };
            issue_item: {
                Args: { p_item_id: number; p_qty: number; p_person: string; p_comment?: string; p_created_at?: string };
                Returns: Json;
            };
            receive_item: {
                Args: { p_item_id: number; p_qty: number; p_person: string; p_comment?: string; p_created_at?: string };
                Returns: Json;
            };
        };
    };
}

export type PublicTableName = keyof Database['public']['Tables'];
export type PublicTableRow<T extends PublicTableName> = Database['public']['Tables'][T]['Row'];
export type PublicFunctionName = keyof Database['public']['Functions'];
export type PublicFunctionArgs<T extends PublicFunctionName> = Database['public']['Functions'][T]['Args'];
export type PublicFunctionReturns<T extends PublicFunctionName> = Database['public']['Functions'][T]['Returns'];
