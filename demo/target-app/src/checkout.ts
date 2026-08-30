export interface CheckoutState {
  itemCount: number;
  pending: boolean;
}

/** Whether the checkout button should submit the current cart. */
export function shouldSubmitCheckout(state: CheckoutState): boolean {
  return state.itemCount > 0 && !state.pending;
}
