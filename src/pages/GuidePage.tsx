import { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Card, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { guideResource } from '@/features/guide/guideResource';

const FEEDBACK_PREFIX = 'training-tracker.guide-helpful.';

export default function GuidePage() {
  const { articleId } = useParams();
  const resource = guideResource();
  const article = resource.articles.find((entry) => entry.id === articleId);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(() => {
    if (!articleId) return null;
    try {
      return localStorage.getItem(`${FEEDBACK_PREFIX}${articleId}`);
    } catch {
      return null;
    }
  });

  const categories = useMemo(
    () => Array.from(new Set(resource.articles.map((entry) => entry.category))),
    [resource.articles],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return resource.articles.filter((entry) => {
      if (category && entry.category !== category) return false;
      if (!needle) return true;
      const searchable = [
        entry.title,
        entry.summary,
        entry.category,
        ...entry.keywords,
        ...entry.content.flatMap((section) => [
          section.heading ?? '',
          ...(section.paragraphs ?? []),
          ...(section.steps ?? []),
          section.note ?? '',
          section.warning ?? '',
        ]),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return searchable.includes(needle);
    });
  }, [category, query, resource.articles]);

  if (articleId && !article) {
    return (
      <>
        <PageHeader title={resource.ui.title} backTo="/hilfe" />
        <EmptyState
          title={resource.ui.noResults}
          description=""
          icon={<BookOpen size={28} aria-hidden="true" />}
          action={
            <Link to="/hilfe" className="text-sm font-medium text-accent">
              {resource.ui.title}
            </Link>
          }
        />
      </>
    );
  }

  if (article) {
    const related = article.relatedArticleIds
      .map((id) => resource.articles.find((entry) => entry.id === id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const saveFeedback = (value: 'yes' | 'no') => {
      setFeedback(value);
      try {
        localStorage.setItem(`${FEEDBACK_PREFIX}${article.id}`, value);
      } catch {
        // Feedback is optional; unavailable storage never blocks the guide.
      }
    };

    return (
      <>
        <PageHeader title={article.title} subtitle={article.summary} backTo="/hilfe" />
        <article className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{article.category}</Badge>
            <span className="text-xs text-muted">
              {resource.ui.updated}: {article.updatedAt}
            </span>
          </div>

          {article.content.map((section, index) => (
            <Card key={`${article.id}-${section.heading ?? index}`}>
              {section.heading ? (
                <h2 className="text-base font-semibold">{section.heading}</h2>
              ) : null}
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm leading-relaxed text-muted">
                  {paragraph}
                </p>
              ))}
              {section.steps ? (
                <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-relaxed">
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : null}
              {section.note ? (
                <p className="mt-3 rounded-xl border border-accent/30 bg-surface-2 p-3 text-sm leading-relaxed">
                  <strong>{resource.ui.note}:</strong> {section.note}
                </p>
              ) : null}
              {section.warning ? (
                <p className="mt-3 rounded-xl border border-warning/40 bg-surface-2 p-3 text-sm leading-relaxed">
                  <strong className="text-warning">{resource.ui.warning}:</strong>{' '}
                  {section.warning}
                </p>
              ) : null}
            </Card>
          ))}

          {related.length > 0 ? (
            <section aria-labelledby="related-guide">
              <h2 id="related-guide" className="mb-2 text-sm font-semibold">
                {resource.ui.related}
              </h2>
              <div className="grid gap-2">
                {related.map((entry) => (
                  <Link
                    key={entry.id}
                    to={`/hilfe/${entry.id}`}
                    className="rounded-2xl border border-border bg-surface p-3 active:bg-surface-2"
                  >
                    <span className="font-medium">{entry.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {entry.summary}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <Card>
            <h2 className="text-sm font-semibold">{resource.ui.helpful}</h2>
            {feedback ? (
              <p className="mt-2 text-sm text-muted">{resource.ui.helpfulThanks}</p>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => saveFeedback('yes')}>
                  {resource.ui.helpfulYes}
                </Button>
                <Button size="sm" onClick={() => saveFeedback('no')}>
                  {resource.ui.helpfulNo}
                </Button>
              </div>
            )}
          </Card>
        </article>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={resource.ui.title}
        subtitle={resource.ui.subtitle}
        backTo="/mehr"
      />
      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium">{resource.ui.search}</span>
        <span className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-border bg-surface px-3">
          <Search size={18} className="text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={resource.ui.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-muted"
          />
        </span>
      </label>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[null, ...categories].map((entry) => (
          <button
            key={entry ?? 'all'}
            type="button"
            className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium ${
              category === entry
                ? 'border-accent bg-accent text-accent-contrast'
                : 'border-border bg-surface text-text'
            }`}
            onClick={() => setCategory(entry)}
          >
            {entry ?? resource.ui.allCategories}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={resource.ui.noResults}
          description=""
          icon={<BookOpen size={28} aria-hidden="true" />}
        />
      ) : (
        <ul className="grid gap-3">
          {filtered.map((entry) => (
            <li key={entry.id}>
              <Link
                to={`/hilfe/${entry.id}`}
                className="block rounded-2xl border border-border bg-surface p-4 active:bg-surface-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{entry.title}</h2>
                  <Badge>{entry.category}</Badge>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {entry.summary}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
