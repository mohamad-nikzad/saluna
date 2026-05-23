// PROTOTYPE — throwaway UI prototypes for the public salon page.
// Switch variants via ?variant=A|B|D|F|G|H. Delete this directory once a direction wins.

import { Suspense } from 'react'
import { PrototypeSwitcher, type VariantInfo } from './PrototypeSwitcher'
import { VariantA } from './variants/A'
import { VariantB } from './variants/B'
import { VariantD } from './variants/D'
import { VariantF } from './variants/F'
import { VariantG } from './variants/G'
import { VariantH } from './variants/H'

export const dynamic = 'force-dynamic'

const VARIANTS: VariantInfo[] = [
  { key: 'A', name: 'Inline expand' },
  { key: 'B', name: 'Split panel' },
  { key: 'D', name: 'Visual grid' },
  { key: 'F', name: 'Minimal mobile grid' },
  { key: 'G', name: 'Iconic' },
  { key: 'H', name: 'Agenda timeline' },
]

type SearchParams = Promise<{ variant?: string }>

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { variant } = await searchParams
  const v = (variant ?? 'A').toUpperCase()

  return (
    <>
      {v === 'A' && <VariantA />}
      {v === 'B' && <VariantB />}
      {v === 'D' && <VariantD />}
      {v === 'F' && <VariantF />}
      {v === 'G' && <VariantG />}
      {v === 'H' && <VariantH />}
      {!['A', 'B', 'D', 'F', 'G', 'H'].includes(v) && <VariantA />}
      <Suspense fallback={null}>
        <PrototypeSwitcher variants={VARIANTS} />
      </Suspense>
    </>
  )
}
