"use client";

import { useState, useRef, KeyboardEvent } from "react";

interface TagInputProps {
  /** The hidden form field name that stores comma-separated skills */
  name: string;
  /** Initial comma-separated skills string from DB */
  initialValue?: string | null;
  placeholder?: string;
}

/**
 * Tag input component for skills.
 * Renders individual tag chips + an invisible <input> carrying the
 * comma-separated value for the parent server action form.
 *
 * Press Enter or comma to add a tag. Click × to remove.
 */
export default function TagInput({
  name,
  initialValue,
  placeholder = "Type a skill and press Enter…",
}: TagInputProps) {
  const [tags, setTags] = useState<string[]>(() => {
    if (!initialValue) return [];
    return initialValue
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  });
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const serialized = tags.join(", ");

  function addTag(raw: string) {
    const value = raw.trim();
    if (!value || tags.includes(value)) return;
    setTags((prev) => [...prev, value]);
  }

  function removeTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
      setInput("");
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  function handleBlur() {
    if (input.trim()) {
      addTag(input);
      setInput("");
    }
  }

  return (
    <div>
      {/* Hidden input carries serialized value to server action */}
      <input type="hidden" name={name} value={serialized} />

      {/* Tag container — click anywhere to focus the text input */}
      <div
        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 cursor-text flex flex-wrap gap-1.5 items-center"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
              className="text-indigo-400 hover:text-indigo-700 transition-colors leading-none"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder-slate-400"
        />
      </div>

      <p className="mt-1 text-xs text-slate-400">
        Press <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px]">Enter</kbd>{" "}
        or <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px]">,</kbd>{" "}
        to add · click × to remove
      </p>
    </div>
  );
}
