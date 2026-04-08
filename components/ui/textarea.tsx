"use client";
import { TextareaHTMLAttributes, forwardRef } from 'react';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextareaImpl(props, ref) {
    return (
      <textarea
        ref={ref}
        {...props}
        className={
          'w-full min-h-[80px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ' +
          (props.className ?? '')
        }
      />
    );
  }
);
