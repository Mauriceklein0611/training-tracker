import { useTranslation } from 'react-i18next';
import { Segmented } from '@/components/ui/Field';
import { setTemplateGroupOptions } from '@/db/repositories/templates';
import type { GroupRestMode, GroupType } from '@/types';

/**
 * Header shown above the members of a superset/circuit in the template editor:
 * the block letter and the two group-wide choices (type and rest mode).
 */
export function TemplateGroupHeader({
  templateId,
  groupId,
  letter,
  groupType,
  groupRestMode,
  memberCount,
}: {
  templateId: string;
  groupId: string;
  letter: string;
  groupType: GroupType;
  groupRestMode: GroupRestMode;
  memberCount: number;
}) {
  const { t } = useTranslation('library');
  return (
    <div className="mb-2 grid gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-accent px-2 text-sm font-bold text-accent-contrast">
          {letter}
        </span>
        <span className="text-sm font-semibold">
          {t('group.summary', {
            type: t(`group.type.${groupType}`),
            exercises: t(
              memberCount === 1 ? 'count.exerciseOne' : 'count.exerciseOther',
              { count: memberCount },
            ),
          })}
        </span>
      </div>
      <Segmented
        label={t('group.typeLabel')}
        value={groupType}
        onChange={(value) =>
          void setTemplateGroupOptions(templateId, groupId, {
            groupType: value as GroupType,
          })
        }
        options={[
          { value: 'superset', label: t('group.type.superset') },
          { value: 'circuit', label: t('group.type.circuit') },
        ]}
      />
      <Segmented
        label={t('group.restLabel')}
        value={groupRestMode}
        onChange={(value) =>
          void setTemplateGroupOptions(templateId, groupId, {
            groupRestMode: value as GroupRestMode,
          })
        }
        options={[
          { value: 'round', label: t('group.rest.round') },
          { value: 'each', label: t('group.rest.each') },
        ]}
      />
    </div>
  );
}
