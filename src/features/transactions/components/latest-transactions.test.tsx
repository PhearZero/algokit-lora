import { beforeEach, describe, expect, it } from 'vitest'
import { createStore } from 'jotai'
import algosdk from 'algosdk'
import { microAlgos } from '@algorandfoundation/algokit-utils'
import { executeComponentTest } from '@/tests/test-component'
import { render, waitFor } from '@/tests/testing-library'
import { mainnetId } from '@/features/network/data/types'
import { selectedNetworkAtomId, storedSelectedNetworkIdAtom } from '@/features/network/data'
import { settingsStore } from '@/features/settings/data'
import { knownLogicsigNamesAtom } from '@/features/programs/data/known-address-names'
import { TransactionSummary, TransactionType } from '../models'
import { LatestTransactions } from './latest-transactions'

const tinymanValidatorId = 1002541853n
const tinymanValidatorAddress = algosdk.getApplicationAddress(tinymanValidatorId).toString()
const xChainAddress = algosdk.getApplicationAddress(1n).toString()
const plainAddress = algosdk.getApplicationAddress(2n).toString()

const summary = (id: string, type: TransactionType, from: string, to: TransactionSummary['to']): TransactionSummary => ({
  id,
  type,
  from,
  to,
  fee: microAlgos(1000),
})

describe('latest-transactions', () => {
  beforeEach(() => {
    settingsStore.set(storedSelectedNetworkIdAtom, mainnetId)
    settingsStore.set(selectedNetworkAtomId)
  })

  it('shows known applications, application accounts and logic signature accounts by name', async () => {
    const store = createStore()
    store.set(knownLogicsigNamesAtom, new Map([[xChainAddress, ['xChain 0x4ca8…e32e', Date.now()] as const]]))

    return executeComponentTest(
      () =>
        render(
          <LatestTransactions
            latestTransactions={[
              summary('APPCALL', TransactionType.AppCall, xChainAddress, tinymanValidatorId),
              summary('PAYMENT', TransactionType.Payment, plainAddress, tinymanValidatorAddress),
            ]}
          />,
          undefined,
          store
        ),
      async (component) => {
        await waitFor(() => {
          expect(component.getByText('Tinyman v2 validator').getAttribute('title')).toBe(tinymanValidatorId.toString())
          expect(component.getByText('Tinyman v2 validator account').getAttribute('title')).toBe(tinymanValidatorAddress)
          expect(component.getByText('xChain 0x4ca8…e32e').getAttribute('title')).toBe(xChainAddress)
        })
        // Unknown addresses are still shortened.
        expect(component.queryByText(plainAddress)).toBeNull()
      }
    )
  })
})
