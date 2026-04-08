'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type FancySelectOption = {
  value: string;
  label: string;
  description?: string;
  color?: string;
};

export type FancySelectGroup = {
  label: string;
  options: FancySelectOption[];
};

type FancySelectProps = {
  value: string;
  onChange: (value: string) => void;
  groups?: FancySelectGroup[];
  options?: FancySelectOption[];
  placeholder?: string;
  buttonClassName?: string;
  panelClassName?: string;
};

export function FancySelect({
  value,
  onChange,
  groups,
  options,
  placeholder = 'Select an option',
  buttonClassName = '',
  panelClassName = ''
}: FancySelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelContentRef = useRef<HTMLDivElement | null>(null);
  const selectIdRef = useRef(`fancy-select-${Math.random().toString(36).slice(2)}`);
  const [isOpen, setIsOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const [panelMaxHeight, setPanelMaxHeight] = useState<number>(288);

  const normalizedGroups = useMemo(() => {
    if (groups?.length) {
      return groups;
    }

    return options?.length ? [{ label: '', options }] : [];
  }, [groups, options]);

  const selectedOption = useMemo(
    () => normalizedGroups.flatMap((group) => group.options).find((option) => option.value === value),
    [normalizedGroups, value]
  );

  useEffect(() => {
    function handleOtherSelectOpened(event: Event) {
      const customEvent = event as CustomEvent<{ selectId: string }>;

      if (customEvent.detail?.selectId !== selectIdRef.current) {
        setIsOpen(false);
      }
    }

    window.addEventListener('fancy-select-open', handleOtherSelectOpened as EventListener);

    return () => {
      window.removeEventListener('fancy-select-open', handleOtherSelectOpened as EventListener);
    };
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePanelPlacement() {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      const rect = root.getBoundingClientRect();
  const panelContent = panelContentRef.current;
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const shouldOpenAbove = spaceBelow < 260 && spaceAbove > spaceBelow;
  const availableHeight = Math.max(96, shouldOpenAbove ? spaceAbove - 12 : spaceBelow - 12);
  const contentHeight = panelContent?.scrollHeight ?? 288;
  const nextMaxHeight = Math.min(320, availableHeight, contentHeight);

      setOpenAbove(shouldOpenAbove);
      setPanelMaxHeight(nextMaxHeight);
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    updatePanelPlacement();

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', updatePanelPlacement);
    window.addEventListener('scroll', updatePanelPlacement, true);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', updatePanelPlacement);
      window.removeEventListener('scroll', updatePanelPlacement, true);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((current) => {
            const nextIsOpen = !current;

            if (nextIsOpen) {
              window.dispatchEvent(
                new CustomEvent('fancy-select-open', {
                  detail: { selectId: selectIdRef.current }
                })
              );
            }

            return nextIsOpen;
          });
        }}
        className={`flex w-full items-center justify-between gap-3 rounded-[18px] border border-[rgba(118,31,47,0.14)] bg-white/88 px-4 py-3 text-left text-sm text-[rgb(var(--page-foreground))] shadow-[0_10px_24px_rgba(81,39,43,0.06)] outline-none transition hover:border-[rgba(118,31,47,0.22)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)] ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-3">
          {selectedOption?.color ? (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: selectedOption.color }}
            />
          ) : null}
          <span className="truncate">
            {selectedOption?.label || placeholder}
          </span>
        </span>
        <span className={`text-xs text-[rgba(64,35,37,0.52)] transition ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen ? (
        <div
          className={`absolute left-0 right-0 z-30 overflow-hidden rounded-[22px] border border-[rgba(118,31,47,0.12)] bg-[rgba(255,250,246,0.98)] p-2 shadow-[0_24px_60px_rgba(81,39,43,0.18)] backdrop-blur-xl ${openAbove ? 'bottom-full mb-2' : 'top-full mt-2'} ${panelClassName}`}
        >
          <div ref={panelContentRef} className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: `${panelMaxHeight}px` }}>
            {normalizedGroups.map((group) => (
              <div key={group.label || 'options'} className="pb-2 last:pb-0">
                {group.label ? (
                  <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(64,35,37,0.45)]">
                    {group.label}
                  </div>
                ) : null}
                <div className="space-y-1">
                  {group.options.map((option) => {
                    const selected = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          onChange(option.value);
                          setIsOpen(false);
                        }}
                        className={`flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition ${selected ? 'bg-[rgba(118,31,47,0.08)] text-[rgb(var(--wine))]' : 'hover:bg-[rgba(118,31,47,0.05)] text-[rgb(var(--page-foreground))]'}`}
                      >
                        <span className="flex min-w-0 items-start gap-3">
                          {option.color ? (
                            <span
                              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: option.color }}
                            />
                          ) : null}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{option.label}</span>
                            {option.description ? (
                              <span className="block text-xs text-[rgba(64,35,37,0.52)]">
                                {option.description}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        {selected ? <span className="text-xs font-bold">✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}