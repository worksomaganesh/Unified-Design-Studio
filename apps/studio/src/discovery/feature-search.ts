type SearchableFeature = {
  categoryId: string;
  title: string;
  summary: string;
  purpose: string;
  location: string;
  howTo: string;
};
type SearchableCategory = { id: string; title: string };

export function filterProductFeatures<T extends SearchableFeature>(
  features: T[],
  categories: SearchableCategory[],
  query: string,
  selectedCategory = "all"
): T[] {
  const needle = query.trim().toLocaleLowerCase();
  return features.filter(feature => {
    if (selectedCategory !== "all" && feature.categoryId !== selectedCategory) return false;
    if (!needle) return true;
    const categoryTitle = categories.find(category => category.id === feature.categoryId)?.title ?? "";
    const searchable = [feature.title, feature.summary, feature.purpose, feature.location, feature.howTo, categoryTitle].join(" ").toLocaleLowerCase();
    return searchable.includes(needle);
  });
}
