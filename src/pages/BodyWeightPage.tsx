import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState, Stat } from '@/components/ui/Card';
import { NumberField, TextField } from '@/components/ui/Field';
import {
  bodyValueTrend,
  deleteBodyWeightEntry,
  hasAnyBodyValue,
  listBodyWeightEntries,
  upsertBodyWeightEntry,
} from '@/db/repositories/bodyWeight';
import { BodyMetricChart } from '@/features/body/BodyMetricChart';
import { useToast } from '@/hooks/useToast';
import { parseNumberInput } from '@/services/validation';
import type { BodyMeasurements } from '@/types';
import { formatDate, todayKey } from '@/utils/date';
import {
  BODY_MEASUREMENT_FIELDS,
  formatCm,
  formatKg,
  formatPercentValue,
} from '@/utils/format';

type MeasurementDraft = Partial<Record<keyof BodyMeasurements, string>>;

/** Parses one form field; returns undefined for empty and NaN for nonsense. */
function readNumber(raw: string): number | undefined | typeof NaN {
  const parsed = parseNumberInput(raw);
  return parsed == null ? undefined : parsed;
}

export default function BodyWeightPage() {
  const toast = useToast();
  const entries = useLiveQuery(() => listBodyWeightEntries(), [], []);

  const [date, setDate] = useState(() => todayKey());
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [measurements, setMeasurements] = useState<MeasurementDraft>({});
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [measurementsOpen, setMeasurementsOpen] = useState(false);

  const trends = useMemo(
    () => ({
      weight: bodyValueTrend(entries, (entry) => entry.weightKg),
      bodyFat: bodyValueTrend(entries, (entry) => entry.bodyFatPercent),
      waist: bodyValueTrend(entries, (entry) => entry.measurements?.waistCm),
      chest: bodyValueTrend(entries, (entry) => entry.measurements?.chestCm),
    }),
    [entries],
  );

  const resetForm = () => {
    setWeight('');
    setBodyFat('');
    setMeasurements({});
    setNotes('');
    setErrors({});
  };

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {};

    const weightValue = readNumber(weight);
    if (
      weightValue != null &&
      (Number.isNaN(weightValue) || weightValue <= 0 || weightValue > 700)
    ) {
      nextErrors.weight = 'Bitte ein Gewicht zwischen 0 und 700 kg eingeben.';
    }

    const bodyFatValue = readNumber(bodyFat);
    if (
      bodyFatValue != null &&
      (Number.isNaN(bodyFatValue) || bodyFatValue <= 0 || bodyFatValue > 70)
    ) {
      nextErrors.bodyFat = 'Bitte einen Körperfettanteil zwischen 0 und 70 % eingeben.';
    }

    const parsedMeasurements: BodyMeasurements = {};
    for (const field of BODY_MEASUREMENT_FIELDS) {
      const value = readNumber(measurements[field.key] ?? '');
      if (value == null) continue;
      if (Number.isNaN(value) || value <= 0 || value > 300) {
        nextErrors[field.key] = 'Wert zwischen 0 und 300 cm.';
        continue;
      }
      parsedMeasurements[field.key] = value;
    }

    const input = {
      date,
      weightKg: Number.isNaN(weightValue) ? undefined : weightValue,
      bodyFatPercent: Number.isNaN(bodyFatValue) ? undefined : bodyFatValue,
      measurements: parsedMeasurements,
      notes: notes.trim(),
    };

    // An entry has to carry at least one measured value — an empty row would
    // only clutter the diary.
    if (Object.keys(nextErrors).length === 0 && !hasAnyBodyValue(input)) {
      nextErrors.weight = 'Bitte mindestens einen Wert eintragen.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await upsertBodyWeightEntry(input);
    resetForm();
    toast.show('Körperdaten gespeichert.', 'success');
  };

  return (
    <>
      <PageHeader
        title="Körperdaten"
        subtitle="Optional — für Trainingsauswertungen nicht erforderlich"
        backTo="/mehr"
      />

      <Card className="mb-4">
        <CardHeader
          title="Eintrag hinzufügen"
          subtitle="Pro Tag wird ein Eintrag geführt. Trägst du am selben Tag erneut etwas ein, werden die Werte ergänzt — bereits gespeicherte Angaben bleiben erhalten."
          as="h2"
        />
        <div className="grid gap-3">
          <TextField
            label="Datum"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Gewicht (kg)"
              decimal
              value={weight}
              error={errors.weight}
              placeholder="z. B. 78,5"
              onChange={(event) => setWeight(event.target.value)}
            />
            <NumberField
              label="Körperfett (%)"
              decimal
              value={bodyFat}
              error={errors.bodyFat}
              placeholder="z. B. 17,5"
              onChange={(event) => setBodyFat(event.target.value)}
            />
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <button
              type="button"
              aria-expanded={measurementsOpen}
              onClick={() => setMeasurementsOpen((open) => !open)}
              className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left text-sm font-medium"
            >
              <span>Körpermaße (cm)</span>
              <span aria-hidden="true" className="text-accent">
                {measurementsOpen ? 'Ausblenden' : 'Einblenden'}
              </span>
            </button>

            {measurementsOpen ? (
              <>
                <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">
                  Alle Felder sind freiwillig. Trage nur ein, was du tatsächlich gemessen
                  hast — leere Felder bleiben leer und werden nicht geschätzt.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {BODY_MEASUREMENT_FIELDS.map((field) => (
                    <NumberField
                      key={field.key}
                      label={field.label}
                      decimal
                      value={measurements[field.key] ?? ''}
                      error={errors[field.key]}
                      onChange={(event) =>
                        setMeasurements((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <TextField
            label="Notiz"
            value={notes}
            placeholder="Optional, z. B. morgens nüchtern"
            onChange={(event) => setNotes(event.target.value)}
          />
          <Button variant="primary" onClick={() => void handleSave()}>
            Speichern
          </Button>
        </div>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          title="Noch keine Einträge"
          description="Das Körperdatentagebuch ist freiwillig. Gewicht, Körperfett und Umfänge fließen bewusst nicht in Volumenberechnungen ein — Körpergewichtsübungen werden nicht mit einem geschätzten Kilogramm-Volumen bewertet."
        />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Stat
              label="Gewicht"
              value={formatKg(trends.weight.latest)}
              hint={
                trends.weight.change == null
                  ? 'aktuell'
                  : `${trends.weight.change > 0 ? '+' : ''}${formatKg(trends.weight.change)} seit Beginn`
              }
              tone="accent"
            />
            <Stat
              label="Körperfett"
              value={formatPercentValue(trends.bodyFat.latest)}
              hint={
                trends.bodyFat.change == null
                  ? 'aktuell'
                  : `${trends.bodyFat.change > 0 ? '+' : ''}${formatPercentValue(trends.bodyFat.change)} seit Beginn`
              }
            />
            <Stat
              label="Taille"
              value={formatCm(trends.waist.latest)}
              hint={
                trends.waist.change == null
                  ? 'aktuell'
                  : `${trends.waist.change > 0 ? '+' : ''}${formatCm(trends.waist.change)} seit Beginn`
              }
            />
            <Stat
              label="Brust"
              value={formatCm(trends.chest.latest)}
              hint={
                trends.chest.change == null
                  ? 'aktuell'
                  : `${trends.chest.change > 0 ? '+' : ''}${formatCm(trends.chest.change)} seit Beginn`
              }
            />
          </div>

          <div className="mb-4">
            <BodyMetricChart entries={entries} />
          </div>

          <ul className="grid gap-2">
            {entries.map((entry) => {
              const recorded = BODY_MEASUREMENT_FIELDS.filter(
                (field) => entry.measurements?.[field.key] != null,
              );
              return (
                <li
                  key={entry.id}
                  className="rounded-2xl border border-border bg-surface p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="numeric font-medium">
                        {[
                          entry.weightKg != null ? formatKg(entry.weightKg) : null,
                          entry.bodyFatPercent != null
                            ? formatPercentValue(entry.bodyFatPercent)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Nur Maße'}
                      </p>
                      <p className="text-sm text-muted">
                        {formatDate(entry.date)}
                        {entry.notes ? ` · ${entry.notes}` : ''}
                      </p>
                    </div>
                    <IconButton
                      label={`Eintrag vom ${formatDate(entry.date)} löschen`}
                      onClick={async () => {
                        await deleteBodyWeightEntry(entry.id);
                        toast.show('Eintrag gelöscht.', 'info');
                      }}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </IconButton>
                  </div>

                  {recorded.length > 0 ? (
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2 text-xs">
                      {recorded.map((field) => (
                        <div key={field.key} className="flex justify-between gap-2">
                          <dt className="truncate text-muted">{field.label}</dt>
                          <dd className="numeric font-medium">
                            {formatCm(entry.measurements?.[field.key])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
