/**
 * Format a currency amount
 * 
 * @param amount The amount to format (in cents)
 * @param currency The currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatAmount(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount / 100); // Assuming amount is stored in cents
} 