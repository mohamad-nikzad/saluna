import { describe, expect, it } from 'vitest'

import { parseVcfFile } from './vcf'

describe('parseVcfFile', () => {
  it('decodes QUOTED-PRINTABLE UTF-8 FN values from iPhone-style exports', () => {
    const text = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D8=B9=D9=85=D9=87=20=D8=B5=D8=AF=DB=8C=D9=82=D9=87',
      'TEL;TYPE=CELL:09123456789',
      'END:VCARD',
      'BEGIN:VCARD',
      'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D8=A2=D9=88=D8=A7=DB=8C=20=D9=85=D9=87=D8=B1',
      'TEL;TYPE=CELL:09121111111',
      'END:VCARD',
    ].join('\n')

    const contacts = parseVcfFile(text)
    expect(contacts).toHaveLength(2)
    expect(contacts[0]?.name).toBe('عمه صدیقه')
    expect(contacts[1]?.name).toBe('آوای مهر')
  })

  it('decodes QUOTED-PRINTABLE structured N values', () => {
    const text = [
      'BEGIN:VCARD',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D8=B5=D8=AF=DB=8C=D9=82=D9=87;=D8=B9=D9=85=D9=87;;;;',
      'TEL:09123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.name).toBe('عمه صدیقه')
  })

  it('parses a single card with FN and TEL;TYPE=CELL', () => {
    const text = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:مریم احمدی',
      'TEL;TYPE=CELL:09123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact).toMatchObject({
      name: 'مریم احمدی',
      phone: '09123456789',
    })
    expect(contact.localId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('parses multiple cards in one file', () => {
    const text = [
      'BEGIN:VCARD',
      'FN:علی',
      'TEL:09121111111',
      'END:VCARD',
      'BEGIN:VCARD',
      'FN:سارا',
      'TEL:09122222222',
      'END:VCARD',
    ].join('\n')

    const contacts = parseVcfFile(text)
    expect(contacts).toHaveLength(2)
    expect(contacts[0]?.name).toBe('علی')
    expect(contacts[1]?.name).toBe('سارا')
  })

  it('unfolds RFC 2425 continuation lines', () => {
    const text = [
      'BEGIN:VCARD',
      'FN:مریم',
      ' NOTE:This is a long note that continues',
      '  on the next line',
      'TEL:09123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.phone).toBe('09123456789')
  })

  it('falls back to structured N when FN is missing', () => {
    const text = [
      'BEGIN:VCARD',
      'N:احمدی;مریم;;;',
      'TEL:09123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.name).toBe('مریم احمدی')
  })

  it('normalizes Persian digit phone numbers', () => {
    const text = [
      'BEGIN:VCARD',
      'FN:مریم',
      'TEL:۰۹۱۲۳۴۵۶۷۸۹',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.phone).toBe('09123456789')
  })

  it('normalizes international TEL values with +98 prefix', () => {
    const text = [
      'BEGIN:VCARD',
      'FN:مریم',
      'TEL:+989123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.phone).toBe('09123456789')
  })

  it('strips tel: URI prefix from TEL values', () => {
    const text = [
      'BEGIN:VCARD',
      'FN:مریم',
      'TEL;TYPE=CELL:tel:+989123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.phone).toBe('09123456789')
  })

  it('prefers CELL over HOME when both are present', () => {
    const text = [
      'BEGIN:VCARD',
      'FN:مریم',
      'TEL;TYPE=HOME:02112345678',
      'TEL;TYPE=CELL:09123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.phone).toBe('09123456789')
  })

  it('prefers bare CELL param over HOME (vCard 3.0 TEL;CELL;VOICE)', () => {
    const text = [
      'BEGIN:VCARD',
      'FN:مریم',
      'TEL;TYPE=HOME:02112345678',
      'TEL;CELL;VOICE:09123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.phone).toBe('09123456789')
  })

  it('prefers TYPE=IPHONE over HOME (iOS-style exports)', () => {
    const text = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:مریم',
      'TEL;TYPE=HOME;TYPE=VOICE:02112345678',
      'TEL;TYPE=IPHONE;TYPE=VOICE:+989123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.phone).toBe('09123456789')
  })

  it('parses iOS grouped item1.TEL properties', () => {
    const text = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:مریم',
      'item1.TEL;type=CELL;type=VOICE:+989123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.phone).toBe('09123456789')
  })

  it('prefers grouped item2.TEL mobile over item1.TEL home', () => {
    const text = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:مریم',
      'item1.TEL;type=HOME;type=VOICE:02112345678',
      'item2.TEL;type=CELL;type=VOICE:09123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.phone).toBe('09123456789')
  })

  it('returns an empty array for empty input', () => {
    expect(parseVcfFile('')).toEqual([])
  })

  it('falls back to structured N when FN is empty whitespace', () => {
    const text = [
      'BEGIN:VCARD',
      'FN:   ',
      'N:احمدی;مریم;;;',
      'TEL:09123456789',
      'END:VCARD',
    ].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact?.name).toBe('مریم احمدی')
  })

  it('includes nameless cards so the classifier can count them as invalid', () => {
    const text = ['BEGIN:VCARD', 'TEL:09123456789', 'END:VCARD'].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact).toMatchObject({
      name: '',
      phone: '09123456789',
    })
  })

  it('returns phone null when a card has no TEL', () => {
    const text = ['BEGIN:VCARD', 'FN:مریم', 'END:VCARD'].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact).toMatchObject({
      name: 'مریم',
      phone: null,
    })
  })

  it('parses empty card blocks as nameless contacts without phone', () => {
    const text = ['BEGIN:VCARD', 'END:VCARD'].join('\n')

    const [contact] = parseVcfFile(text)
    expect(contact).toMatchObject({
      name: '',
      phone: null,
    })
  })

  it('ignores malformed text outside VCARD blocks', () => {
    const text = [
      'not a vcard',
      'BEGIN:VCARD',
      'FN:Valid',
      'TEL:09121111111',
      'END:VCARD',
      'BEGIN:VCARD without end',
    ].join('\n')

    const contacts = parseVcfFile(text)
    expect(contacts).toHaveLength(1)
    expect(contacts[0]).toMatchObject({
      name: 'Valid',
      phone: '09121111111',
    })
  })
})
