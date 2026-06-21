import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

/**
 * The one card. White surface, 12px radius, soft line, calm shadow.
 * `padding="md"` (20px) for dense lists, `"lg"` (24px) for primary content.
 */
const cardVariants = cva(
  "rounded-[14px] border border-line-card bg-surface shadow-card",
  {
    variants: {
      padding: {
        none: "p-0",
        md: "p-5",
        lg: "p-6",
      },
    },
    defaultVariants: { padding: "lg" },
  }
);

export function CardV2({
  className,
  padding,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "article" | "li";
} & VariantProps<typeof cardVariants>) {
  return <Tag className={cn(cardVariants({ padding }), className)}>{children}</Tag>;
}
