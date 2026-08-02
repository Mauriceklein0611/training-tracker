import { describe, expect, it } from 'vitest';
import { guide as deGuide } from '@/i18n/locales/de/guide';
import { guide as enGuide } from '@/i18n/locales/en/guide';

describe('offline guide resources', () => {
  it('ships the same deep-link ids in German and English', () => {
    expect(enGuide.articles.map((article) => article.id)).toEqual(
      deGuide.articles.map((article) => article.id),
    );
  });

  it('only references existing related articles', () => {
    for (const resource of [deGuide, enGuide]) {
      const ids = new Set(resource.articles.map((article) => article.id));
      for (const article of resource.articles) {
        expect(article.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        for (const related of article.relatedArticleIds)
          expect(ids.has(related)).toBe(true);
      }
    }
  });
});
