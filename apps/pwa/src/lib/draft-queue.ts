import {
  flexibleRequestGroup,
  type FlexibleRequestGroup,
} from '@repo/salon-core/appointment-request-timing'

type DraftTiming = {
  acceptableDates: string[]
  createdAt: string
}

const GROUP_ORDER: FlexibleRequestGroup[] = [
  'this-week',
  'next-week',
  'later',
  'elapsed',
]

export function organizeDrafts<T extends DraftTiming>(
  drafts: T[],
  today: string,
) {
  const grouped = new Map<
    FlexibleRequestGroup,
    Array<{ draft: T; earliestRemainingDate: string | null }>
  >()
  for (const draft of drafts) {
    const timing = flexibleRequestGroup(draft.acceptableDates, today)
    grouped.set(timing.group, [
      ...(grouped.get(timing.group) ?? []),
      { draft, earliestRemainingDate: timing.earliestRemainingDate },
    ])
  }

  return GROUP_ORDER.flatMap((groupId) => {
    const group = grouped.get(groupId)
    if (!group) return []
    return [
      {
        id: groupId,
        drafts: [...group]
          .sort(
            (a, b) =>
              (a.earliestRemainingDate ?? '').localeCompare(
                b.earliestRemainingDate ?? '',
              ) || a.draft.createdAt.localeCompare(b.draft.createdAt),
          )
          .map(({ draft }) => draft),
      },
    ]
  })
}
