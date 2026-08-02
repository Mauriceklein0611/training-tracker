import { CircleHelp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { guideResource } from '@/features/guide/guideResource';

export function HelpButton({
  articleId,
  compact = false,
}: {
  articleId: string;
  compact?: boolean;
}) {
  const article = guideResource().articles.find((entry) => entry.id === articleId);
  if (!article) return null;

  return (
    <Link
      to={`/hilfe/${articleId}`}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-medium text-accent active:bg-surface-2"
      aria-label={article.title}
      title={article.title}
    >
      <CircleHelp size={18} aria-hidden="true" />
      <span className={compact ? 'sr-only' : undefined}>{article.title}</span>
    </Link>
  );
}
