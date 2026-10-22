"use client";

import { useCallback, useState } from "react";
import { Button } from "./button";
import { Modal, type ModalSize } from "./modal";

type ModalButtonProps = {
  /** Content of the button that opens the modal. */
  trigger: React.ReactNode;
  variant?: "primary" | "navy" | "secondary" | "danger" | "success" | "ghost";
  buttonSize?: "sm" | "md";
  className?: string;
  /** Greys the button out; `disabledReason` shows as its tooltip. */
  disabled?: boolean;
  disabledReason?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  size?: ModalSize;
  footer?: React.ReactNode;
  /** Modal body; a function receives `close` (e.g. to close after a save). */
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
};

/** A button that opens a modal — use it for "View all", confirmations and small forms. */
export function ModalButton({ trigger, variant = "secondary", buttonSize, className, disabled, disabledReason, children, ...modal }: ModalButtonProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button
        variant={variant}
        size={buttonSize}
        className={className}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
      >
        {trigger}
      </Button>
      <Modal open={open} onClose={close} {...modal}>
        {typeof children === "function" ? children(close) : children}
      </Modal>
    </>
  );
}
