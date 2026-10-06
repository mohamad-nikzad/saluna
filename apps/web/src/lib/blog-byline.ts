/** Public Blog Article credit belongs to the selected reusable profiles.
 * EmDash can infer an account-linked profile; that is editing ownership and
 * must never replace Saluna's default public credit.
 */
export function blogArticleBylines(
  credits: Array<{
    source?: string
    byline: { displayName: string }
  }> = [],
): string[] {
  const selected = credits
    .filter((credit) => credit.source === 'explicit')
    .map((credit) => credit.byline.displayName)
  return selected.length ? selected : ['تیم سالونا']
}
