"use client";
import { InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function InputImpl(props, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={
          'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ' +
          (props.className ?? '')
        }
      />
    );
  }
);
