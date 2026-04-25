export function shouldDeadLetterDelivery(deliveryCount: number | undefined, maxAttempts: number): boolean {
  return deliveryCount !== undefined && deliveryCount > maxAttempts;
}

export function shouldPauseFreshReads(pendingCount: number, maxPendingMessages: number): boolean {
  return pendingCount >= maxPendingMessages;
}
