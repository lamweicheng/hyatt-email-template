"use client";
import { ReactNode, useEffect, useState } from 'react';
import { clsx } from 'clsx';

export function Accordion({
  title,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  indicator
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  indicator?: ReactNode;
}) {
  const isControlled = typeof controlledOpen === 'boolean';
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  useEffect(() => {
    // Update uncontrolled state if defaultOpen changes (initial mount or when new accordion appears)
    if (!isControlled) setUncontrolledOpen(defaultOpen);
  }, [defaultOpen, isControlled]);

  const open = isControlled ? (controlledOpen as boolean) : uncontrolledOpen;
  const toggle = () => {
    if (isControlled) {
      onOpenChange?.(!open);
    } else {
      setUncontrolledOpen((o) => !o);
    }
  };

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={toggle}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-3 rounded-t-lg',
          open ? 'bg-slate-100' : 'bg-white'
        )}
      >
        <div className="font-medium text-left flex items-center gap-2">
          <span>{title}</span>
          {indicator}
        </div>
        <span className="ml-2 text-slate-500">{open ? '−' : '+'}</span>
      </button>
      <div className={clsx('px-4 pb-4', open ? 'block' : 'hidden')}>
        {children}
      </div>
    </div>
  );
}