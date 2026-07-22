import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/Card';
import {
  groupMuscleGroupsByCategory,
  normalizeMuscleQuery,
  searchMuscleGroups,
} from '@/constants/muscleGroups';
import { cn } from '@/utils/cn';

/**
 * Searchable, offline muscle-group picker built on the shared Dialog primitive.
 *
 * `single` selects exactly one and closes; `multiple` toggles and stays open
 * until dismissed. Values in `excludeLabels` are hidden (used to keep the
 * primary group out of the secondary selection). Selection is exposed via
 * canonical German labels — the values stored on an exercise.
 */
export function MuscleGroupPicker({
  open,
  onClose,
  mode,
  selected,
  onChange,
  title,
  excludeLabels = [],
}: {
  open: boolean;
  onClose: () => void;
  mode: 'single' | 'multiple';
  selected: string[];
  onChange: (selected: string[]) => void;
  title: string;
  excludeLabels?: string[];
}) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus the search field once the dialog is open.
  useEffect(() => {
    if (open) {
      setQuery('');
      const id = window.setTimeout(() => searchRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const excluded = useMemo(
    () => new Set(excludeLabels.map(normalizeMuscleQuery)),
    [excludeLabels],
  );
  const selectedSet = useMemo(
    () => new Set(selected.map(normalizeMuscleQuery)),
    [selected],
  );

  const groups = useMemo(() => {
    const results = searchMuscleGroups(query).filter(
      (entry) => !excluded.has(normalizeMuscleQuery(entry.label)),
    );
    return groupMuscleGroupsByCategory(results);
  }, [query, excluded]);

  const toggle = (label: string) => {
    if (mode === 'single') {
      onChange([label]);
      onClose();
      return;
    }
    const isSelected = selectedSet.has(normalizeMuscleQuery(label));
    onChange(
      isSelected
        ? selected.filter(
            (entry) => normalizeMuscleQuery(entry) !== normalizeMuscleQuery(label),
          )
        : [...selected, label],
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button variant="primary" onClick={onClose}>
          Fertig
        </Button>
      }
    >
      <TextField
        ref={searchRef}
        label="Suchen"
        type="search"
        value={query}
        placeholder="Name, Kategorie oder z. B. „Lat“, „Rear Delt“"
        onChange={(event) => setQuery(event.target.value)}
      />

      <div
        className="mt-3"
        role="listbox"
        aria-label={title}
        aria-multiselectable={mode === 'multiple'}
      >
        {groups.length === 0 ? (
          <EmptyState
            title="Keine Treffer"
            description="Passe den Suchbegriff an. Du kannst nach Namen, Kategorie oder englischen Begriffen suchen."
          />
        ) : (
          <div className="grid gap-3">
            {groups.map((group) => (
              <div key={group.category} role="group" aria-label={group.category}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {group.category}
                </h3>
                <div className="grid gap-1">
                  {group.entries.map((entry) => {
                    const isSelected = selectedSet.has(normalizeMuscleQuery(entry.label));
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => toggle(entry.label)}
                        className={cn(
                          'flex min-h-[44px] items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm',
                          isSelected
                            ? 'border-accent bg-accent/15 font-medium'
                            : 'border-border bg-surface-2 active:bg-surface-3',
                        )}
                      >
                        <span className="min-w-0 truncate">{entry.label}</span>
                        {isSelected ? (
                          <Check
                            size={18}
                            className="shrink-0 text-accent"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
