import { SHORTCUT_GROUPS, type ShortcutChord } from "./shortcutCatalog";

function KeyChord({ chord }: { chord: ShortcutChord }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={chord.join(" plus ")}
    >
      {chord.map((key, index) => (
        <span key={key} className="inline-flex items-center gap-1">
          {index > 0 && (
            <span
              className="text-[10px] text-content-tinted/45"
              aria-hidden="true"
            >
              +
            </span>
          )}
          <kbd className="min-w-6 rounded-md bg-white/[0.06] px-1.5 py-1 text-center font-mono text-[10px] font-medium leading-none text-content ring-1 ring-white/12 shadow-sm">
            {key}
          </kbd>
        </span>
      ))}
    </span>
  );
}

export function ShortcutsSection() {
  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <p className="text-[12px] leading-relaxed text-content-tinted">
        Keyboard shortcuts are available as a read-only reference. They apply
        outside text fields unless a specific editing context is noted.
      </p>

      {SHORTCUT_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`shortcut-group-${group.id}`}>
          <div className="mb-2.5">
            <h3
              id={`shortcut-group-${group.id}`}
              className="text-[13px] font-semibold text-content"
            >
              {group.label}
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-content-tinted/70">
              {group.description}
            </p>
          </div>

          <ul className="overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/8">
            {group.shortcuts.map((shortcut) => (
              <li
                key={shortcut.id}
                className="flex flex-col gap-2 border-b border-white/[0.06] px-3.5 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-content">
                    {shortcut.label}
                  </p>
                  {shortcut.description && (
                    <p className="mt-0.5 text-[10px] leading-relaxed text-content-tinted/65">
                      {shortcut.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:max-w-[52%] sm:flex-shrink-0 sm:justify-end">
                  {shortcut.keys.map((chord, index) => (
                    <span
                      key={chord.join("+")}
                      className="inline-flex items-center gap-1.5"
                    >
                      {index > 0 && (
                        <span className="text-[9px] uppercase tracking-wide text-content-tinted/45">
                          or
                        </span>
                      )}
                      <KeyChord chord={chord} />
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
