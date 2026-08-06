import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, Stat } from '@/components/ui/Card';
import { NumberField, TextField } from '@/components/ui/Field';
import { listBodyWeightEntries } from '@/db/repositories/bodyWeight';
import { useSettings } from '@/hooks/useSettings';
import { parseNumberInput } from '@/services/validation';
import {
  ageFromBirthDate,
  bodyMassIndex,
  isPlausibleBirthDate,
  normalizeDisplayName,
  normalizeHeightCm,
} from '@/services/profile';
import { formatDate } from '@/utils/date';
import { formatKg, formatNumber } from '@/utils/format';

/**
 * The personal profile (#46).
 *
 * Everything here is optional and stays on the device. Deliberately *not* an
 * input for the body weight: that stays a dated entry under "Körperdaten" so it
 * keeps its history — this screen only shows the latest value and links there,
 * rather than offering a second place to type the same number.
 */
export default function ProfilePage() {
  const { t } = useTranslation('more');
  const { settings, loaded, update } = useSettings();
  const entries = useLiveQuery(() => listBodyWeightEntries(), [], []);

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [height, setHeight] = useState('');
  const [errors, setErrors] = useState<{ birthDate?: string; height?: string }>({});

  // Fill the form once the stored settings have arrived; later edits are the
  // user's, so the drafts are not overwritten on every live-query tick.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!loaded || hydrated) return;
    setName(settings.displayName ?? '');
    setBirthDate(settings.birthDate ?? '');
    setHeight(settings.heightCm == null ? '' : String(settings.heightCm));
    setHydrated(true);
  }, [loaded, hydrated, settings]);

  const latestWeight = entries.find((entry) => entry.weightKg != null);
  const age = ageFromBirthDate(settings.birthDate);
  const bmi = bodyMassIndex(settings.heightCm, latestWeight?.weightKg);

  const commitName = () => {
    void update({ displayName: normalizeDisplayName(name) });
  };

  const commitBirthDate = (value: string) => {
    setBirthDate(value);
    if (value === '') {
      setErrors((current) => ({ ...current, birthDate: undefined }));
      void update({ birthDate: undefined });
      return;
    }
    if (!isPlausibleBirthDate(value)) {
      setErrors((current) => ({
        ...current,
        birthDate: t('screens.profile.personal.invalidBirthDate'),
      }));
      return;
    }
    setErrors((current) => ({ ...current, birthDate: undefined }));
    void update({ birthDate: value });
  };

  const commitHeight = (value: string) => {
    setHeight(value);
    if (value.trim() === '') {
      setErrors((current) => ({ ...current, height: undefined }));
      void update({ heightCm: undefined });
      return;
    }
    const normalized = normalizeHeightCm(parseNumberInput(value));
    if (normalized == null) {
      setErrors((current) => ({
        ...current,
        height: t('screens.profile.personal.invalidHeight'),
      }));
      return;
    }
    setErrors((current) => ({ ...current, height: undefined }));
    void update({ heightCm: normalized });
  };

  return (
    <>
      <PageHeader
        title={t('screens.profile.title')}
        subtitle={t('screens.profile.subtitle')}
        backTo="/mehr"
      />

      <div className="grid gap-4">
        <Card>
          <CardHeader
            title={t('screens.profile.personal.title')}
            subtitle={t('screens.profile.personal.subtitle')}
            as="h2"
          />
          <div className="grid gap-4">
            <TextField
              label={t('screens.profile.personal.name')}
              value={name}
              placeholder={t('screens.profile.personal.namePlaceholder')}
              hint={t('screens.profile.personal.nameHint')}
              autoComplete="given-name"
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
            />
            <TextField
              label={t('screens.profile.personal.birthDate')}
              type="date"
              value={birthDate}
              error={errors.birthDate}
              hint={t('screens.profile.personal.birthDateHint')}
              onChange={(event) => commitBirthDate(event.target.value)}
            />
            <NumberField
              label={t('screens.profile.personal.height')}
              value={height}
              error={errors.height}
              hint={t('screens.profile.personal.heightHint')}
              onChange={(event) => commitHeight(event.target.value)}
            />
            {age != null ? (
              <Stat
                label={t('screens.profile.personal.age')}
                value={t('screens.profile.personal.ageValue', { value: age })}
              />
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t('screens.profile.body.title')}
            subtitle={t('screens.profile.body.subtitle')}
            as="h2"
          />
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label={t('screens.profile.body.currentWeight')}
                value={
                  latestWeight?.weightKg != null
                    ? formatKg(latestWeight.weightKg)
                    : t('screens.profile.body.noWeight')
                }
                hint={
                  latestWeight
                    ? t('screens.profile.body.weightDate', {
                        date: formatDate(latestWeight.date),
                      })
                    : undefined
                }
              />
              {bmi != null ? (
                <Stat
                  label={t('screens.profile.body.bmi')}
                  value={formatNumber(bmi, 1)}
                  hint={t('screens.profile.body.bmiHint')}
                />
              ) : null}
            </div>
            <p className="text-sm text-muted">
              {t('screens.profile.body.weightPurpose')}
            </p>
            <Link
              to="/mehr/koerpergewicht"
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-accent"
            >
              {t('screens.profile.body.openBody')}
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
