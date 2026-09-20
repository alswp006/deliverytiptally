import type { OrderInput, StorageResult, DeliveryOrder } from "@/lib/types";

/**
 * Validates order input without modifying storage.
 * Returns validation errors with specific Korean messages.
 */
export function validateOrderInput(
  input: OrderInput
): StorageResult<void> {
  // Implementation to come
  throw new Error("Not implemented");
}

/**
 * Adds a new order to storage.
 * Generates id starting with 'o_', sets createdAt === updatedAt.
 * Returns LIMIT if 2,000+ orders exist, QUOTA if storage is full.
 */
export function addOrder(
  input: OrderInput
): StorageResult<{ id: string }> {
  // Implementation to come
  throw new Error("Not implemented");
}

/**
 * Updates an existing order by id.
 * Updates only the provided fields, always updates updatedAt.
 * Returns NOT_FOUND if id doesn't exist.
 */
export function updateOrder(
  id: string,
  input: Partial<OrderInput>
): StorageResult<void> {
  // Implementation to come
  throw new Error("Not implemented");
}

/**
 * Deletes an order by id.
 * Returns NOT_FOUND if id doesn't exist.
 */
export function deleteOrder(id: string): StorageResult<void> {
  // Implementation to come
  throw new Error("Not implemented");
}
