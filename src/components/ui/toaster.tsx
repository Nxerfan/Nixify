"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

/**
 * Premium toaster — renders active toasts with the redesigned dark-green
 * glassmorphism toast component. Each toast gets the accent stripe + icon
 * from the Toast component itself.
 */

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={4000} swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="flex-1 space-y-1 py-0.5 pl-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
