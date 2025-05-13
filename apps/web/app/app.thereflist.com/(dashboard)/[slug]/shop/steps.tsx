import { Store } from "lucide-react";

export const SHOP_STEPS = [
  {
    stepNumber: 1,
    label: "Create Link",
    href: "/shop",
    step: "create-link",
    icon: Store,
  },
  {
    stepNumber: 2,
    label: "Who's buying?",
    href: "/shop/buyer",
    step: "buyer",
    icon: Store,
  },
] as const;

export type ShopStep = (typeof SHOP_STEPS)[number]["step"]; 