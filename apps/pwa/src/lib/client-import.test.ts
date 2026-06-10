import { describe, it, expect } from 'vitest'
import type {
  ClientImportCounts,
  ClientImportPreviewRow,
} from '@repo/salon-core'

import { formatImportCounts, getBulkImportSubmitClients } from './client-import'
import { formatBulkImportToast } from './client-import-toast'

function row(
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

function counts(
  overrides: Partial<ClientImportCounts> = {},
): ClientImportCounts {
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
    ).toBe('۱۲ مخاطب · ۸ قابل افزودن · ۲ تکراری · ۲ نامعتبر')
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
    ).toBe('هیچ مخاطب قابل افزودنی نیست')
  })
})

describe('getBulkImportSubmitClients', () => {
  it('includes all selected valid rows regardless of search visibility', () => {
    const rows: ClientImportPreviewRow[] = [
      row({
        localId: '1',
        name: 'Alice',
        phone: '09121111111',
        selected: true,
      }),
      row({ localId: '2', name: 'Bob', phone: '09122222222', selected: true }),
      row({
        localId: '3',
        name: 'Carol',
        phone: '09123333333',
        selected: false,
      }),
    ]

    expect(getBulkImportSubmitClients(rows)).toEqual([
      { name: 'Alice', phone: '09121111111' },
      { name: 'Bob', phone: '09122222222' },
    ])
  })

  it('excludes unselected and invalid rows from submit count', () => {
    const rows: ClientImportPreviewRow[] = [
      row({
        localId: '1',
        name: 'Valid',
        phone: '09121111111',
        selected: true,
      }),
      row({ localId: '2', name: '', phone: '09122222222', selected: true }),
      row({
        localId: '3',
        name: 'Hidden',
        phone: '09123333333',
        selected: true,
      }),
      row({ localId: '4', name: 'Off', phone: '09124444444', selected: false }),
    ]

    expect(getBulkImportSubmitClients(rows)).toEqual([
      { name: 'Valid', phone: '09121111111' },
      { name: 'Hidden', phone: '09123333333' },
    ])
  })
})

describe('formatBulkImportToast', () => {
  it('formats created-only toast', () => {
    expect(formatBulkImportToast(8, [])).toBe('۸ مشتری اضافه شد')
  })

  it('formats partial success toast with duplicates', () => {
    expect(
      formatBulkImportToast(6, [
        { phone: '09121111111', reason: 'duplicate-phone' },
        { phone: '09122222222', reason: 'duplicate-phone' },
      ]),
    ).toBe('۶ اضافه شد · ۲ تکراری نادیده گرفته شد')
  })

  it('formats partial success toast with invalid rows', () => {
    expect(
      formatBulkImportToast(6, [{ phone: '09121111111', reason: 'invalid' }]),
    ).toBe('۶ اضافه شد · ۱ نامعتبر نادیده گرفته شد')
  })

  it('formats partial success toast with mixed skips', () => {
    expect(
      formatBulkImportToast(6, [
        { phone: '09121111111', reason: 'duplicate-phone' },
        { phone: '09122222222', reason: 'invalid' },
      ]),
    ).toBe('۶ اضافه شد · ۱ تکراری نادیده گرفته شد · ۱ نامعتبر نادیده گرفته شد')
  })

  it('formats duplicate-only toast', () => {
    expect(
      formatBulkImportToast(0, [
        { phone: '09121111111', reason: 'duplicate-phone' },
        { phone: '09122222222', reason: 'duplicate-phone' },
      ]),
    ).toBe('۲ تکراری نادیده گرفته شد')
  })

  it('formats invalid-only toast', () => {
    expect(
      formatBulkImportToast(0, [{ phone: '09121111111', reason: 'invalid' }]),
    ).toBe('۱ نامعتبر نادیده گرفته شد')
  })
})
