import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('more');
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
      nextErrors.weight = t('screens.body.validation.weight');
    }

    const bodyFatValue = readNumber(bodyFat);
    if (
      bodyFatValue != null &&
      (Number.isNaN(bodyFatValue) || bodyFatValue <= 0 || bodyFatValue > 70)
    ) {
      nextErrors.bodyFat = t('screens.body.validation.bodyFat');
    }

    const parsedMeasurements: BodyMeasurements = {};
    for (const field of BODY_MEASUREMENT_FIELDS) {
      const value = readNumber(measurements[field.key] ?? '');
      if (value == null) continue;
      if (Number.isNaN(value) || value <= 0 || value > 300) {
        nextErrors[field.key] = t('screens.body.validation.measurement');
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
      nextErrors.weight = t('screens.body.validation.atLeastOne');
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await upsertBodyWeightEntry(input);
    resetForm();
    toast.show(t('screens.body.toast.saved'), 'success');
  };

  return (
    <>
      <PageHeader
        title={t('screens.body.title')}
        subtitle={t('screens.body.subtitle')}
        backTo="/mehr"
      />

      <Card className="mb-4">
        <CardHeader
          title={t('screens.body.form.title')}
          subtitle={t('screens.body.form.subtitle')}
          as="h2"
        />
        <div className="grid gap-3">
          <TextField
            label={t('screens.body.form.date')}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label={t('screens.body.form.weight')}
              decimal
              value={weight}
              error={errors.weight}
              placeholder={t('screens.body.form.weightPlaceholder')}
              onChange={(event) => setWeight(event.target.value)}
            />
            <NumberField
              label={t('screens.body.form.bodyFat')}
              decimal
              value={bodyFat}
              error={errors.bodyFat}
              placeholder={t('screens.body.form.bodyFatPlaceholder')}
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
              <span>{t('screens.body.form.measurements')}</span>
              <span aria-hidden="true" className="text-accent">
                {measurementsOpen
                  ? t('screens.body.form.hideMeasurements')
                  : t('screens.body.form.showMeasurements')}
              </span>
            </button>

            {measurementsOpen ? (
              <>
                <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">
                  {t('screens.body.form.measurementsHint')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {BODY_MEASUREMENT_FIELDS.map((field) => (
                    <NumberField
                      key={field.key}
                      label={t(`screens.body.measurements.${field.key}`)}
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
            label={t('screens.body.form.note')}
            value={notes}
            placeholder={t('screens.body.form.notePlaceholder')}
            onChange={(event) => setNotes(event.target.value)}
          />
          <Button variant="primary" onClick={() => void handleSave()}>
            {t('screens.action.save')}
          </Button>
        </div>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          title={t('screens.body.empty.title')}
          description={t('screens.body.empty.description')}
        />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Stat
              label={t('screens.body.stats.weight')}
              value={formatKg(trends.weight.latest)}
              hint={
                trends.weight.change == null
                  ? t('screens.body.stats.current')
                  : t('screens.body.stats.sinceStart', {
                      value: `${trends.weight.change > 0 ? '+' : ''}${formatKg(trends.weight.change)}`,
                    })
              }
              tone="accent"
            />
            <Stat
              label={t('screens.body.stats.bodyFat')}
              value={formatPercentValue(trends.bodyFat.latest)}
              hint={
                trends.bodyFat.change == null
                  ? t('screens.body.stats.current')
                  : t('screens.body.stats.sinceStart', {
                      value: `${trends.bodyFat.change > 0 ? '+' : ''}${formatPercentValue(trends.bodyFat.change)}`,
                    })
              }
            />
            <Stat
              label={t('screens.body.stats.waist')}
              value={formatCm(trends.waist.latest)}
              hint={
                trends.waist.change == null
                  ? t('screens.body.stats.current')
                  : t('screens.body.stats.sinceStart', {
                      value: `${trends.waist.change > 0 ? '+' : ''}${formatCm(trends.waist.change)}`,
                    })
              }
            />
            <Stat
              label={t('screens.body.stats.chest')}
              value={formatCm(trends.chest.latest)}
              hint={
                trends.chest.change == null
                  ? t('screens.body.stats.current')
                  : t('screens.body.stats.sinceStart', {
                      value: `${trends.chest.change > 0 ? '+' : ''}${formatCm(trends.chest.change)}`,
                    })
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
                          .join(' · ') || t('screens.body.list.measurementsOnly')}
                      </p>
                      <p className="text-sm text-muted">
                        {formatDate(entry.date)}
                        {entry.notes ? ` · ${entry.notes}` : ''}
                      </p>
                    </div>
                    <IconButton
                      label={t('screens.body.list.deleteEntry', {
                        date: formatDate(entry.date),
                      })}
                      onClick={async () => {
                        await deleteBodyWeightEntry(entry.id);
                        toast.show(t('screens.body.toast.deleted'), 'info');
                      }}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </IconButton>
                  </div>

                  {recorded.length > 0 ? (
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2 text-xs">
                      {recorded.map((field) => (
                        <div key={field.key} className="flex justify-between gap-2">
                          <dt className="truncate text-muted">
                            {t(`screens.body.measurements.${field.key}`)}
                          </dt>
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
