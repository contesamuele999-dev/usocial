"use client";
/**
 * Picker emoji minimale: griglia delle emoji più usate sui social.
 */
import { useState } from "react";

const EMOJI = [
  "😀", "😂", "😍", "🤩", "😎", "🥳", "😢", "😮", "🤔", "🙌",
  "👍", "👏", "🔥", "💪", "🚀", "⭐", "✨", "💡", "🎯", "✅",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🎉", "📈", "📣",
  "👀", "💬", "🔗", "📌", "🗓️", "⏰", "🎁", "🏆", "☕", "🌟",
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-secondary px-3 py-1.5"
        title="Inserisci emoji"
      >
        😊
      </button>
      {open && (
        <div className="absolute z-20 mt-1 grid w-64 grid-cols-8 gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded p-1 text-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
