// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
  managerReadQueryKeys,
  managerServicesQueryKey,
} from '#/lib/query-keys'

describe('manager read query keys', () => {
  it('uses manager-scoped key for services collection', () => {
    expect(managerReadQueryKeys.services).toEqual(['manager', 'services'])
  })

  it('invalidates services collection independently in the shared cache', () => {
    const queryClient = new QueryClient()
    const services = [{ id: 'service-1' }]

    queryClient.setQueryData(managerServicesQueryKey, services)

    void queryClient.invalidateQueries({ queryKey: managerServicesQueryKey })

    expect(
      queryClient.getQueryState(managerServicesQueryKey)?.isInvalidated,
    ).toBe(true)
  })
})
