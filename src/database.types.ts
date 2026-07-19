export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Timestamp = string;
export type BigIntId = number;

export interface RowOperation<Row> {
    Row: Row;
    Insert: Partial<Row>;
    Update: Partial<Row>;
}

export interface Database {
    public: {
        Tables: {
            inventory_items: RowOperation<{
                id: BigIntId;
                name: string;
                category: string | null;
                quantity: number;
                unit: string;
                min_quantity: number | null;
                photo_url: string | null;
                created_at: Timestamp | null;
                updated_at: Timestamp | null;
                is_internal: boolean;
                price_unit: number | null;
                price_source: string | null;
                price_url: string | null;
                price_checked_at: Timestamp | null;
                price_confidence: 'manual' | 'internet' | 'low' | 'medium' | 'high' | null;
            }>;
            inventory_logs: RowOperation<{
                id: BigIntId;
                item_id: BigIntId | null;
                item_name: string;
                quantity: number;
                issued_to: string | null;
                note: string | null;
                issued_at: Timestamp;
            }>;
            inventory_receipts: RowOperation<{
                id: BigIntId;
                item_id: BigIntId | null;
                item_name: string;
                quantity: number;
                supplier: string | null;
                note: string | null;
                received_at: Timestamp;
            }>;
            inventory_audits: RowOperation<{
                id: BigIntId;
                created_at: Timestamp;
                note: string | null;
                total_items: number;
                items_with_diff: number;
            }>;
            inventory_audit_items: RowOperation<{
                id: BigIntId;
                audit_id: BigIntId;
                item_id: BigIntId | null;
                item_name: string;
                category: string | null;
                unit: string | null;
                qty_before: number;
                qty_actual: number;
            }>;
            schedule: RowOperation<{
                month_key: string;
                data: Json;
            }>;
            garbage: RowOperation<{
                month_key: string;
                data: Json;
            }>;
            dispatcher: RowOperation<{
                month_key: string;
                data: Json | null;
            }>;
            chat: RowOperation<{
                id: BigIntId;
                author: string;
                text: string;
                created_at: Timestamp | null;
            }>;
            photos: RowOperation<{
                id: string;
                month_key: string;
                day: number;
                role: string;
                url: string;
                created_at: Timestamp | null;
            }>;
            app_auth: RowOperation<{
                id: number;
                pin_hash: string;
            }>;
            app_pin_attempts: RowOperation<{
                pin_name: string;
                failed_count: number;
                locked_until: Timestamp | null;
                last_failed_at: Timestamp;
            }>;
            osbb_app_auth: RowOperation<{
                id: number;
                lock_pin_hash: string;
                reset_pin_hash: string;
            }>;
            osbb_app_pin_attempts: RowOperation<{
                pin_name: string;
                failed_count: number;
                locked_until: Timestamp | null;
                last_failed_at: Timestamp;
            }>;
            osbb_telegram_config: RowOperation<{
                id: number;
                chat_id: string;
            }>;
            telegram_config: RowOperation<{
                id: number;
                bot_token: string;
                chat_id: string;
            }>;
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
                Args: { table_name: 'schedule' | 'garbage' | 'dispatcher'; p_month_key: string; attempt: string };
                Returns: boolean;
            };
            verify_pin: {
                Args: { attempt: string };
                Returns: boolean;
            };
            issue_item: {
                Args: { p_item_id: BigIntId; p_qty: number; p_person: string; p_note?: string | null; p_issued_at?: Timestamp | null };
                Returns: Array<{ new_quantity: number; item_name: string; unit: string }>;
            };
            receive_item: {
                Args: { p_item_id: BigIntId; p_qty: number; p_supplier?: string | null; p_note?: string | null; p_received_at?: Timestamp | null };
                Returns: Array<{ new_quantity: number; item_name: string; unit: string }>;
            };
            delete_inventory_item: {
                Args: { p_item_id: BigIntId; attempt: string };
                Returns: Json;
            };
            delete_inventory_log: {
                Args: { p_log_id: BigIntId; attempt: string };
                Returns: Json;
            };
            delete_inventory_receipt: {
                Args: { p_receipt_id: BigIntId; attempt: string };
                Returns: Json;
            };
            delete_chat_message: {
                Args: { p_message_id: BigIntId; attempt: string };
                Returns: boolean;
            };
            delete_photo: {
                Args: { p_photo_id: BigIntId; attempt: string };
                Returns: boolean;
            };
            notify_osbb_telegram: {
                Args: { msg: string };
                Returns: undefined;
            };
        };
    };
}

export type PublicTableName = keyof Database['public']['Tables'];
export type PublicTable<T extends PublicTableName> = Database['public']['Tables'][T];
export type PublicTableRow<T extends PublicTableName> = PublicTable<T>['Row'];
export type PublicTableInsert<T extends PublicTableName> = PublicTable<T>['Insert'];
export type PublicTableUpdate<T extends PublicTableName> = PublicTable<T>['Update'];
export type PublicFunctionName = keyof Database['public']['Functions'];
export type PublicFunctionArgs<T extends PublicFunctionName> = Database['public']['Functions'][T]['Args'];
export type PublicFunctionReturns<T extends PublicFunctionName> = Database['public']['Functions'][T]['Returns'];
