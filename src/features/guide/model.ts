export interface GuideSection {
  heading?: string;
  paragraphs?: string[];
  steps?: string[];
  note?: string;
  warning?: string;
}

export interface GuideArticle {
  id: string;
  title: string;
  category: string;
  summary: string;
  keywords: string[];
  content: GuideSection[];
  relatedArticleIds: string[];
  updatedAt: string;
}

export interface GuideResource {
  ui: {
    title: string;
    subtitle: string;
    search: string;
    searchPlaceholder: string;
    allCategories: string;
    noResults: string;
    updated: string;
    related: string;
    helpful: string;
    helpfulYes: string;
    helpfulNo: string;
    helpfulThanks: string;
    note: string;
    warning: string;
  };
  articles: GuideArticle[];
}
