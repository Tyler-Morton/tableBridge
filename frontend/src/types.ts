export type Platform = "doordash" | "ubereats" | "grubhub";
export type ReviewAction = "send" | "flag" | "reject";
export type OrderStatus = "pending_review" | "sent" | "flagged" | "rejected";
export type Role = "owner" | "manager" | "server";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
}

export interface OrderListItem {
  id: number;
  platform: Platform;
  external_order_id: string;
  customer_display_name: string;
  placed_at: string;
  overall_confidence: number;
  flagged: boolean;
  status: OrderStatus;
  item_count: number;
  has_allergies: boolean;
}

export interface MappedModifier {
  modifier_id: number | null;
  modifier_name: string;
  confidence: number;
  note: string | null;
}

export interface MappedItem {
  raw_name: string;
  menu_item_id: number | null;
  menu_item_name: string;
  quantity: number;
  modifiers: MappedModifier[];
  special_instructions: string | null;
  confidence: number;
  needs_review: boolean;
}

export interface ParsedOrder {
  mapped_items: MappedItem[];
  detected_allergies: string[];
  detected_dietary: string[];
  unmappable_notes: string[];
  kitchen_note: string | null;
  overall_confidence: number;
  flagged_for_review: boolean;
}

export interface OrderDetail {
  raw: Record<string, unknown>;
  parsed: ParsedOrder;
  raw_id: number;
  parsed_id: number;
  platform: Platform;
  external_order_id: string;
  placed_at: string;
  pickup_time: string | null;
  customer_display_name: string;
  status: OrderStatus;
}

export interface WSEvent {
  event: string;
  data: Record<string, unknown>;
}
