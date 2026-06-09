import { describe, expect, it } from 'vitest'

import {
  buildCanonicalExistingPhones,
  buildClientImportPreview,
  classifyImportContact,
  formatImportCounts,
  formatImportSkipReasonLabel,
  ImportCountSummary,
  matchesImportRowSearch,
  matchesSkippedRowSearch,
  MAX_BULK_CLIENTS,
  revalidateImportRow,
  summarizeImportCounts,
  toApiSkipReason,
  toPreviewSkipReason,
} from './client-import'
import type {
  ClientImportClassifySkipped,
  ClientImportContactInput,
  ClientImportCounts,
  ClientImportPreviewRow,
  RevalidateImportRowResult,
} from './client-import'
import type { VcfDraftContact } from './vcf'

function draft(
  overrides: Partial<VcfDraftContact> & Pick<VcfDraftContact, 'localId' | 'name'>,
): VcfDraftContact {
  return {
    phone: overrides.phone ?? null,
    ...overrides,
  }
}

function previewRow(
  overrides: Partial<ClientImportPreviewRow> &
    Pick<ClientImportPreviewRow, 'localId'>,
): ClientImportPreviewRow {
  return {
    name: 'Test',
    phone: '09121111111',
    selected: true,
    ...overrides,
  }
}

function counts(overrides: Partial<ClientImportCounts> = {}): ClientImportCounts {
  return {
    totalInFile: 0,
    eligible: 0,
    invalid: 0,
    duplicateExisting: 0,
    duplicateInFile: 0,
    truncated: false,
    ...overrides,
  }
}

describe('buildCanonicalExistingPhones', () => {
  it('canonicalizes +98 numbers to 09 form', () => {
    const set = buildCanonicalExistingPhones(['989123456789', '09121111111'])
    expect(set.has('09123456789')).toBe(true)
    expect(set.has('09121111111')).toBe(true)
  })
})

describe('classifyImportContact', () => {
  const existing = buildCanonicalExistingPhones(['09123333333'])

  it.each([
    {
      label: 'invalid name',
      input: { localId: '1', name: '', phone: '09121111111' },
      expected: { eligible: false, reason: 'invalid', invalidDetail: 'name' },
    },
    {
      label: 'invalid phone',
      input: { localId: '1', name: 'Bad', phone: '123' },
      expected: { eligible: false, reason: 'invalid', invalidDetail: 'invalid-phone' },
    },
    {
      label: 'landline phone',
      input: { localId: '1', name: 'Home', phone: '+98 21 5669 8841' },
      expected: { eligible: false, reason: 'invalid', invalidDetail: 'invalid-phone' },
    },
    {
      label: 'null phone',
      input: { localId: '1', name: 'No phone', phone: null },
      expected: { eligible: false, reason: 'invalid', invalidDetail: 'missing-phone' },
    },
    {
      label: 'duplicate existing',
      input: { localId: '1', name: 'Existing', phone: '09123333333' },
      expected: { eligible: false, reason: 'duplicate-existing' },
    },
    {
      label: '+98 existing duplicate',
      input: { localId: '1', name: 'Existing', phone: '989123456789' },
      context: { canonicalExistingPhones: buildCanonicalExistingPhones(['09123456789']) },
      expected: { eligible: false, reason: 'duplicate-existing' },
    },
  ] as const satisfies ReadonlyArray<{
    label: string
    input: ClientImportContactInput
    context?: { canonicalExistingPhones: ReadonlySet<string> }
    expected: ClientImportClassifySkipped
  }>)('$label', ({ input, context, expected }) => {
    const result = classifyImportContact(input, {
      canonicalExistingPhones: context?.canonicalExistingPhones ?? existing,
    })
    expect(result).toEqual(expected)
  })

  it('marks batch duplicate-in-file and only adds first to seenPhones', () => {
    const seenPhones = new Set<string>()
    const context = {
      canonicalExistingPhones: new Set<string>(),
      seenPhones,
    }

    const first = classifyImportContact(
      { localId: '1', name: 'First', phone: '09121111111' },
      context,
    )
    const second = classifyImportContact(
      { localId: '2', name: 'Second', phone: '09121111111' },
      context,
    )

    expect(first).toEqual({
      eligible: true,
      name: 'First',
      phone: '09121111111',
    })
    expect(second).toEqual({ eligible: false, reason: 'duplicate-in-file' })
    expect(seenPhones).toEqual(new Set(['09121111111']))
  })

  it('returns validated phone on success', () => {
    const result = classifyImportContact(
      { localId: '1', name: '  مریم  ', phone: '۰۹۱۲۳۴۵۶۷۸۹' },
      { canonicalExistingPhones: new Set() },
    )
    expect(result).toEqual({
      eligible: true,
      name: 'مریم',
      phone: '09123456789',
    })
  })
})

describe('formatImportSkipReasonLabel', () => {
  it.each([
    {
      row: { reason: 'invalid' as const, invalidDetail: 'invalid-phone' as const },
      label: 'شماره نامعتبر',
    },
    {
      row: { reason: 'invalid' as const, invalidDetail: 'missing-phone' as const },
      label: 'بدون شماره',
    },
    {
      row: { reason: 'invalid' as const, invalidDetail: 'name' as const },
      label: 'بدون نام',
    },
    {
      row: { reason: 'duplicate-existing' as const },
      label: 'تکراری (موجود)',
    },
    {
      row: { reason: 'duplicate-in-file' as const },
      label: 'تکراری (در فایل)',
    },
  ])('$label', ({ row, label }) => {
    expect(formatImportSkipReasonLabel(row)).toBe(label)
  })
})

describe('toPreviewSkipReason / toApiSkipReason', () => {
  it('maps classifier reasons to preview and API forms', () => {
    expect(toPreviewSkipReason('duplicate-existing')).toBe('duplicateExisting')
    expect(toPreviewSkipReason('duplicate-in-file')).toBe('duplicateInFile')
    expect(toApiSkipReason('duplicate-existing')).toBe('duplicate-existing')
  })
})

describe('buildClientImportPreview', () => {
  it('produces correct counts for mixed buckets', () => {
    const drafts: VcfDraftContact[] = [
      draft({ localId: '1', name: 'Eligible', phone: '09121111111' }),
      draft({ localId: '2', name: 'Invalid', phone: '123' }),
      draft({ localId: '3', name: 'Existing', phone: '09123333333' }),
      draft({ localId: '4', name: 'Dup A', phone: '09124444444' }),
      draft({ localId: '5', name: 'Dup B', phone: '09124444444' }),
    ]

    const preview = buildClientImportPreview(
      drafts,
      new Set(['09123333333']),
    )

    expect(preview.counts).toEqual({
      totalInFile: 5,
      eligible: 2,
      invalid: 1,
      duplicateExisting: 1,
      duplicateInFile: 1,
      truncated: false,
    })
    expect(preview.rows).toEqual([
      {
        localId: '1',
        name: 'Eligible',
        phone: '09121111111',
        selected: true,
      },
      {
        localId: '4',
        name: 'Dup A',
        phone: '09124444444',
        selected: true,
      },
    ])
    expect(preview.skippedRows).toEqual([
      {
        localId: '2',
        name: 'Invalid',
        phone: '123',
        reason: 'invalid',
        invalidDetail: 'invalid-phone',
      },
      {
        localId: '3',
        name: 'Existing',
        phone: '09123333333',
        reason: 'duplicate-existing',
      },
      {
        localId: '5',
        name: 'Dup B',
        phone: '09124444444',
        reason: 'duplicate-in-file',
      },
    ])
  })

  it('marks the first file duplicate as eligible and the second as duplicateInFile', () => {
    const drafts: VcfDraftContact[] = [
      draft({ localId: '1', name: 'First', phone: '09121111111' }),
      draft({ localId: '2', name: 'Second', phone: '09121111111' }),
    ]

    const preview = buildClientImportPreview(drafts, new Set())

    expect(preview.counts.eligible).toBe(1)
    expect(preview.counts.duplicateInFile).toBe(1)
    expect(preview.rows).toHaveLength(1)
    expect(preview.rows[0]?.localId).toBe('1')
  })

  it('detects salon duplicates when VCF phone uses +98 and salon stores 09', () => {
    const drafts: VcfDraftContact[] = [
      draft({ localId: '1', name: 'Existing', phone: '989123456789' }),
    ]

    const preview = buildClientImportPreview(
      drafts,
      new Set(['09123456789']),
    )

    expect(preview.counts).toMatchObject({
      eligible: 0,
      duplicateExisting: 1,
    })
    expect(preview.rows).toEqual([])
  })

  it('classifies salon duplicates via existingPhones', () => {
    const drafts: VcfDraftContact[] = [
      draft({ localId: '1', name: 'Existing', phone: '09121111111' }),
    ]

    const preview = buildClientImportPreview(
      drafts,
      new Set(['09121111111']),
    )

    expect(preview.counts).toMatchObject({
      eligible: 0,
      duplicateExisting: 1,
    })
    expect(preview.rows).toEqual([])
  })

  it('counts nameless drafts as invalid', () => {
    const drafts: VcfDraftContact[] = [
      draft({ localId: '1', name: '', phone: '09121111111' }),
    ]

    const preview = buildClientImportPreview(drafts, new Set())

    expect(preview.counts).toMatchObject({
      totalInFile: 1,
      invalid: 1,
      eligible: 0,
    })
    expect(preview.rows).toEqual([])
  })

  it('treats invalid phones as invalid before duplicate checks', () => {
    const drafts: VcfDraftContact[] = [
      draft({ localId: '1', name: 'Bad phone', phone: '123' }),
      draft({ localId: '2', name: 'Also bad', phone: '123' }),
    ]

    const preview = buildClientImportPreview(
      drafts,
      new Set(['123']),
    )

    expect(preview.counts).toMatchObject({
      invalid: 2,
      duplicateExisting: 0,
      duplicateInFile: 0,
      eligible: 0,
    })
  })

  it('sets truncated when eligible rows exceed MAX_BULK_CLIENTS', () => {
    const drafts: VcfDraftContact[] = Array.from(
      { length: MAX_BULK_CLIENTS + 1 },
      (_, index) =>
        draft({
          localId: `id-${index}`,
          name: `Client ${index}`,
          phone: `0912${String(index).padStart(7, '0')}`,
        }),
    )

    const preview = buildClientImportPreview(drafts, new Set())

    expect(preview.counts.eligible).toBe(MAX_BULK_CLIENTS + 1)
    expect(preview.counts.truncated).toBe(true)
    expect(preview.rows).toHaveLength(MAX_BULK_CLIENTS)
    expect(preview.rows.every((row) => row.selected)).toBe(true)
  })
})

describe('revalidateImportRow', () => {
  const existingPhones = buildCanonicalExistingPhones(['09129999999'])

  it.each([
    {
      label: 'invalid name',
      row: previewRow({ localId: '1', name: '', phone: '09121111111' }),
      others: [] as ClientImportPreviewRow[],
      expected: { valid: false, reason: 'invalid' },
    },
    {
      label: 'invalid phone',
      row: previewRow({ localId: '1', name: 'Bad', phone: '123' }),
      others: [],
      expected: { valid: false, reason: 'invalid' },
    },
    {
      label: 'duplicate existing',
      row: previewRow({ localId: '1', name: 'Existing', phone: '09129999999' }),
      others: [],
      expected: { valid: false, reason: 'duplicate-existing' },
    },
    {
      label: '+98 canonicalization against existing',
      row: previewRow({ localId: '1', name: 'Existing', phone: '989123456789' }),
      others: [],
      contextExisting: buildCanonicalExistingPhones(['09123456789']),
      expected: { valid: false, reason: 'duplicate-existing' },
    },
    {
      label: 'duplicate in file',
      row: previewRow({ localId: '2', name: 'Second', phone: '09121111111' }),
      others: [previewRow({ localId: '1', name: 'First', phone: '09121111111' })],
      expected: { valid: false, reason: 'duplicate-in-file' },
    },
    {
      label: 'valid when unique',
      row: previewRow({ localId: '1', name: 'Unique', phone: '09121111111' }),
      others: [previewRow({ localId: '2', name: 'Other', phone: '09122222222' })],
      expected: { valid: true },
    },
  ] as const satisfies ReadonlyArray<{
    label: string
    row: ClientImportPreviewRow
    others: ClientImportPreviewRow[]
    contextExisting?: ReadonlySet<string>
    expected: RevalidateImportRowResult
  }>)('$label', ({ row, others, contextExisting, expected }) => {
    const result = revalidateImportRow(
      row,
      others,
      contextExisting ?? existingPhones,
    )
    expect(result).toEqual(expected)
  })

  it('ignores self when checking in-file duplicates', () => {
    const row = previewRow({ localId: '1', name: 'Self', phone: '09121111111' })
    expect(revalidateImportRow(row, [row], new Set())).toEqual({ valid: true })
  })
})


describe('matchesImportRowSearch', () => {
  const row = previewRow({
    localId: '1',
    name: 'مریم احمدی',
    phone: '09123456789',
  })

  it('matches empty query', () => {
    expect(matchesImportRowSearch(row, '')).toBe(true)
    expect(matchesImportRowSearch(row, '   ')).toBe(true)
  })

  it('matches partial name case-insensitively', () => {
    expect(matchesImportRowSearch(row, 'مری')).toBe(true)
    expect(matchesImportRowSearch(row, 'احمد')).toBe(true)
    expect(matchesImportRowSearch(row, 'xyz')).toBe(false)
  })

  it('matches canonical phone substring', () => {
    expect(matchesImportRowSearch(row, '912345')).toBe(true)
  })

  it('matches Persian digit display form', () => {
    expect(matchesImportRowSearch(row, '۰۹۱۲')).toBe(true)
    expect(matchesImportRowSearch(row, '۳۴۵۶')).toBe(true)
  })
})

describe('matchesSkippedRowSearch', () => {
  it('matches mixed-script names and phone digits', () => {
    const row = {
      localId: '1',
      name: 'Ali علی',
      phone: '09123456789',
      reason: 'invalid' as const,
    }
    expect(matchesSkippedRowSearch(row, 'ali')).toBe(true)
    expect(matchesSkippedRowSearch(row, 'علی')).toBe(true)
    expect(matchesSkippedRowSearch(row, '0912')).toBe(true)
  })
})

describe('formatImportCounts', () => {
  it('formats mixed buckets with Persian digits', () => {
    expect(
      formatImportCounts(
        counts({
          totalInFile: 12,
          eligible: 8,
          invalid: 2,
          duplicateExisting: 1,
          duplicateInFile: 1,
        }),
      ),
    ).toBe('۱۲ مخاطب در فایل · ۸ قابل افزودن · ۲ تکراری · ۲ نامعتبر')
  })

  it('formats all-eligible summary', () => {
    expect(
      formatImportCounts(
        counts({
          totalInFile: 12,
          eligible: 12,
        }),
      ),
    ).toBe('۱۲ مخاطب · همه قابل افزودن')
  })

  it('appends truncation suffix', () => {
    expect(
      formatImportCounts(
        counts({
          totalInFile: 220,
          eligible: 220,
          truncated: true,
        }),
      ),
    ).toBe('۲۲۰ مخاطب · همه قابل افزودن · فقط ۲۰۰ مورد اول نمایش داده شد')
  })

  it('shows empty-eligible message', () => {
    expect(
      formatImportCounts(
        counts({
          totalInFile: 5,
          invalid: 3,
          duplicateExisting: 2,
        }),
      ),
    ).toBe('هیچ مخاطب قابل افزودنی در فایل نیست')
  })
})

describe('summarizeImportCounts', () => {
  it('classifies count summaries', () => {
    expect(
      summarizeImportCounts(counts({ totalInFile: 5, invalid: 5 })),
    ).toBe(ImportCountSummary.EmptyEligible)
    expect(
      summarizeImportCounts(counts({ totalInFile: 3, eligible: 3 })),
    ).toBe(ImportCountSummary.AllEligible)
    expect(
      summarizeImportCounts(
        counts({ totalInFile: 5, eligible: 2, invalid: 3 }),
      ),
    ).toBe(ImportCountSummary.Mixed)
  })
})
