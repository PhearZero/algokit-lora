import { beforeEach, describe, expect, it } from 'vitest'
import { createStore } from 'jotai'
import algosdk from 'algosdk'
import { executeComponentTest } from '@/tests/test-component'
import { render, waitFor } from '@/tests/testing-library'
import { applicationResultBuilder } from '@/tests/builders/application-result-builder'
import { createReadOnlyAtomAndTimestamp } from '@/features/common/data'
import { mainnetId } from '@/features/network/data/types'
import { selectedNetworkAtomId, storedSelectedNetworkIdAtom } from '@/features/network/data'
import { settingsStore } from '@/features/settings/data'
import { applicationResultsAtom } from '../data'
import { ApplicationLink } from './application-link'

// The global keys every Alpha Arcade order escrow has.
const alphaArcadeOrderKeys = [
  'market_app_id',
  'owner',
  'side',
  'position',
  'price',
  'quantity',
  'quantity_filled',
  'slippage',
  'asset_listed',
  'fee_timer_start',
]

describe('application-link', () => {
  beforeEach(() => {
    settingsStore.set(storedSelectedNetworkIdAtom, mainnetId)
    settingsStore.set(selectedNetworkAtomId)
  })

  it('shows a known deployment by its name, with the ID on hover', async () => {
    return executeComponentTest(
      () => render(<ApplicationLink applicationId={1002541853n} />, undefined, createStore()),
      async (component) => {
        const name = component.getByText('Tinyman v2 validator')
        expect(name.getAttribute('title')).toBe('1002541853')
      }
    )
  })

  it('shows the ID followed by the name where the ID can be copied', async () => {
    return executeComponentTest(
      () => render(<ApplicationLink applicationId={1002541853n} showCopyButton={true} />, undefined, createStore()),
      async (component) => {
        expect(component.getByText('1002541853')).toBeInTheDocument()
        expect(component.getByText('Tinyman v2 validator')).toBeInTheDocument()
      }
    )
  })

  it('names other applications once they have loaded', async () => {
    const applicationResult = applicationResultBuilder().withId(3748385731n).build()
    applicationResult.params.globalState = alphaArcadeOrderKeys.map(
      (key) =>
        new algosdk.indexerModels.TealKeyValue({
          key: new TextEncoder().encode(key),
          value: new algosdk.indexerModels.TealValue({ type: 2, uint: 1n, bytes: new Uint8Array() }),
        })
    )
    const store = createStore()
    store.set(applicationResultsAtom, new Map([[applicationResult.id, createReadOnlyAtomAndTimestamp(applicationResult)]]))

    return executeComponentTest(
      () => render(<ApplicationLink applicationId={applicationResult.id} />, undefined, store),
      async (component) => {
        await waitFor(() => expect(component.getByText('Alpha Arcade order escrow').getAttribute('title')).toBe('3748385731'))
      }
    )
  })

  it('shows other applications by their ID', async () => {
    const applicationResult = applicationResultBuilder().build()
    const store = createStore()
    store.set(applicationResultsAtom, new Map([[applicationResult.id, createReadOnlyAtomAndTimestamp(applicationResult)]]))

    return executeComponentTest(
      () => render(<ApplicationLink applicationId={applicationResult.id} />, undefined, store),
      async (component) => {
        expect(component.getByText(applicationResult.id.toString())).toBeInTheDocument()
      }
    )
  })
})
