import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow,transform] duration-150 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Signal: the one primary action on a screen.
        default: "bg-primary text-primary-foreground hover:bg-signal-ink active:shadow-none",
        // Ink: strong secondary action.
        ink: "bg-ink text-paper hover:bg-ink/85",
        outline:
          "border-ink/25 bg-card text-foreground hover:border-ink hover:bg-card aria-expanded:border-ink",
        secondary: "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_7%)]",
        ghost: "hover:bg-secondary hover:text-foreground aria-expanded:bg-secondary",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "text-signal-ink underline decoration-2 underline-offset-4 hover:decoration-signal",
      },
      size: {
        // ≥40px on touch screens, a little tighter on desktop.
        default: "h-10 gap-1.5 px-3.5 sm:h-9 sm:px-3",
        xs: "h-7 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 px-3 text-[0.8125rem] sm:h-8 sm:px-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-[0.9375rem]",
        icon: "size-10 sm:size-9",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 sm:size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>

function Button({ className, variant = "default", size = "default", render, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }))
  // Rendered as another element (usually a <Link>/<a>): style it like a button but keep its own
  // semantics. Base UI's Button would add role="button", turning links into fake buttons.
  if (render) return <ButtonStyled render={render} className={classes} {...props} />
  return <ButtonPrimitive data-slot="button" className={classes} {...props} />
}

function ButtonStyled({
  render,
  className,
  children,
  ...rest
}: Pick<ButtonProps, "render" | "children"> & { className: string } & Record<string, unknown>) {
  // Forward only attributes that make sense on a link: data-*, aria-*, id, title, handlers.
  const passthrough = Object.fromEntries(
    Object.entries(rest).filter(([k]) => k.startsWith("data-") || k.startsWith("aria-") || k === "id" || k === "title" || k.startsWith("on")),
  )
  return useRender({
    render: render as useRender.RenderProp,
    props: mergeProps<"a">({ className, children: children as React.ReactNode, ...passthrough }, { "data-slot": "button" } as object),
  })
}

export { Button, buttonVariants }
