'use client';

import { useState } from 'react';
import type { DashboardSectionId } from '@/lib/types';

export type DashboardMenuSection = {
  id: DashboardSectionId;
  label: string;
  description: string;
  shown: boolean;
  toggle: () => void;
  compactToggle?: {
    active: boolean;
    toggle: () => void;
    activeLabel: string;
    inactiveLabel: string;
  };
};

export function DashboardMenuModal({
  isOpen,
  sections,
  sectionOrder,
  onClose,
  onReset,
  onReorder
}: {
  isOpen: boolean;
  sections: DashboardMenuSection[];
  sectionOrder: DashboardSectionId[];
  onClose: () => void;
  onReset: () => void;
  onReorder: (draggedId: DashboardSectionId, targetId: DashboardSectionId) => void;
}) {
  const [draggedSectionId, setDraggedSectionId] = useState<DashboardSectionId | null>(null);
  const [menuDropSectionId, setMenuDropSectionId] = useState<DashboardSectionId | null>(null);
  const orderedSections = sectionOrder
    .map((sectionId) => sections.find((section) => section.id === sectionId) ?? null)
    .filter((section): section is DashboardMenuSection => section !== null);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
      <div className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-[30px] p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-label">Menu</p>
            <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
              Customize your dashboard
            </h2>
            <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
              Show or hide sections, drag cards to reorder them, and switch compact layouts where available.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
          >
            Reset to default
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {orderedSections.map((section) => {
            const currentIndex = sectionOrder.indexOf(section.id);
            const isDropTarget = menuDropSectionId === section.id && draggedSectionId !== section.id;

            return (
              <div
                key={section.id}
                draggable
                onDragStart={(event) => {
                  setDraggedSectionId(section.id);
                  setMenuDropSectionId(section.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', section.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (draggedSectionId && draggedSectionId !== section.id) {
                    setMenuDropSectionId(section.id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const draggedId = (event.dataTransfer.getData('text/plain') || draggedSectionId) as DashboardSectionId;
                  setDraggedSectionId(null);
                  setMenuDropSectionId(null);

                  if (!draggedId || draggedId === section.id) {
                    return;
                  }

                  onReorder(draggedId, section.id);
                }}
                onDragEnd={() => {
                  setDraggedSectionId(null);
                  setMenuDropSectionId(null);
                }}
                className="rounded-[22px] border bg-white/65 p-4 transition"
                style={{
                  borderColor: isDropTarget ? 'rgba(0,102,179,0.34)' : 'rgba(118,31,47,0.1)',
                  boxShadow: isDropTarget ? '0 0 0 3px rgba(0,102,179,0.08)' : 'none',
                  opacity: draggedSectionId === section.id ? 0.72 : 1,
                  cursor: draggedSectionId === section.id ? 'grabbing' : 'grab'
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--page-foreground))]">
                      <span className="rounded-full border border-[rgba(0,102,179,0.14)] bg-white/82 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(34,58,86,0.62)]">
                        {currentIndex + 1}
                      </span>
                      <span>{section.label}</span>
                    </div>
                    <div className="mt-1 text-sm text-[rgba(34,58,86,0.62)]">{section.description}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2 sm:ml-4 sm:flex-nowrap sm:self-start">
                    <button
                      type="button"
                      onClick={section.toggle}
                      className="rounded-full border border-[rgba(0,102,179,0.18)] bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))]"
                    >
                      {section.shown ? 'Shown' : 'Hidden'}
                    </button>
                    <div className="rounded-full border border-[rgba(0,102,179,0.18)] bg-white/85 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.62)]">
                      Drag to move
                    </div>
                    {section.compactToggle ? (
                      <button
                        type="button"
                        onClick={section.compactToggle.toggle}
                        aria-pressed={section.compactToggle.active}
                        className="rounded-full border border-[rgba(0,102,179,0.18)] bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))]"
                      >
                        {section.compactToggle.active
                          ? section.compactToggle.activeLabel
                          : section.compactToggle.inactiveLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}