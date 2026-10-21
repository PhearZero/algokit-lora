import { beforeEach, describe, expect, it, vi } from 'vitest'
import { atom, createStore } from 'jotai'
import algosdk from 'algosdk'
import { executeComponentTest } from '@/tests/test-component'
import { render, waitFor } from '@/tests/testing-library'
import { applicationResultBuilder } from '@/tests/builders/application-result-builder'
import { ApplicationLink } from '@/features/applications/components/application-link'
import { applicationResultsAtom } from '@/features/applications/data'
import { createReadOnlyAtomAndTimestamp } from '@/features/common/data'
import { algod, indexer } from '@/features/common/data/algo-client'
import { mainnetId } from '@/features/network/data/types'
import { selectedNetworkAtomId, storedSelectedNetworkIdAtom } from '@/features/network/data'
import { settingsStore } from '@/features/settings/data'
import { TransactionResult } from '@/features/transactions/data/types'
import { indexerTransactionToTransactionResult } from '@/features/transactions/mappers/indexer-transaction-mappers'
import { addCreatedApplications, createdApplicationsAtom } from './known-application-names'

vi.mock('@/features/common/data/algo-client', async () => {
  const original = await vi.importActual('@/features/common/data/algo-client')
  return {
    ...original,
    algod: {
      getApplicationByID: vi.fn(),
    },
    indexer: {
      searchForTransactions: vi.fn(),
    },
  }
})

// MainNet U2CJDJDH…: an Alpha Arcade market call whose inner transaction created order escrow 3749002468, deleted 54 rounds later.
const escrowId = 3749002468n
const escrowCreator = 'M5P5SPLNGSVCLJ2TUOYXJXSDPVFVTQOFZ7MJ2XOPS5Q7TGASIDBI5WQOBE'
const escrowKeys = [
  'asset_listed',
  'fee_timer_start',
  'market_app_id',
  'owner',
  'position',
  'price',
  'quantity',
  'quantity_filled',
  'side',
  'slippage',
]
const indexerTransaction = algosdk.decodeJSON(
  JSON.stringify({
    id: 'U2CJDJDHHHEAGM2V6VWTBINEPAQB35ZCW4YL7O3DLKDTWG6CZUUQ',
    fee: 1000,
    'first-valid': 66184895,
    'last-valid': 66184905,
    sender: 'NZXX6SALQ6FVBMFMNY76E4IHO4S47QOHMO5U3BDYJ3UVVUN4J6IBE65MN4',
    'tx-type': 'appl',
    'confirmed-round': 66184897,
    'application-transaction': { 'application-id': 3748365487, 'on-completion': 'noop' },
    'inner-txns': [
      {
        fee: 0,
        'first-valid': 66184895,
        'last-valid': 66184905,
        sender: escrowCreator,
        'tx-type': 'appl',
        'created-application-index': Number(escrowId),
        'application-transaction': { 'application-id': 0, 'on-completion': 'noop' },
        'global-state-delta': escrowKeys.map((key) => ({ key: btoa(key), value: { action: key === 'owner' ? 1 : 2, uint: 0 } })),
      },
    ],
  }),
  algosdk.indexerModels.Transaction
)
const creatingTransaction = indexerTransactionToTransactionResult(indexerTransaction)

const addAtom = atom(null, (_get, set, transactionResults: TransactionResult[]) => addCreatedApplications(set, transactionResults))

const mockCreationSearch = () => {
  const search = {
    applicationID: vi.fn(),
    limit: vi.fn(),
    do: vi.fn().mockResolvedValue({ transactions: [indexerTransaction] }),
  }
  search.applicationID.mockReturnValue(search)
  search.limit.mockReturnValue(search)
  vi.mocked(indexer.searchForTransactions).mockReturnValue(search as unknown as ReturnType<typeof indexer.searchForTransactions>)
  return search
}

const deletedApplicationResult = () => {
  // What indexer returns for a deleted application: its creator, but no programs or state.
  const applicationResult = applicationResultBuilder().withId(escrowId).build()
  applicationResult.deleted = true
  applicationResult.params.approvalProgram = new Uint8Array()
  applicationResult.params.clearStateProgram = new Uint8Array()
  applicationResult.params.globalState = []
  return applicationResult
}

describe('addCreatedApplications', () => {
  it('remembers the applications created by inner transactions', () => {
    const store = createStore()
    store.set(addAtom, [creatingTransaction])

    const createdApplications = store.get(createdApplicationsAtom)
    expect([...createdApplications.keys()]).toEqual([escrowId])
    const [createdApplication] = createdApplications.get(escrowId)!
    expect(createdApplication.creator).toBe(escrowCreator)
    expect(createdApplication.globalState).toHaveLength(escrowKeys.length)
  })

  it('keeps the same map when nothing is new', () => {
    const store = createStore()
    store.set(addAtom, [creatingTransaction])
    const before = store.get(createdApplicationsAtom)
    store.set(addAtom, [creatingTransaction])

    expect(store.get(createdApplicationsAtom)).toBe(before)
  })
})

describe('application-link for short lived applications', () => {
  beforeEach(() => {
    settingsStore.set(storedSelectedNetworkIdAtom, mainnetId)
    settingsStore.set(selectedNetworkAtomId)
    vi.mocked(algod.getApplicationByID).mockClear()
    vi.mocked(indexer.searchForTransactions).mockReset()
  })

  it('names an application Lora has seen created, without loading it', async () => {
    const store = createStore()
    store.set(addAtom, [creatingTransaction])

    return executeComponentTest(
      () => render(<ApplicationLink applicationId={escrowId} />, undefined, store),
      async (component) => {
        const name = component.getByText('Alpha Arcade order escrow')
        expect(name.getAttribute('title')).toBe(escrowId.toString())
        expect(algod.getApplicationByID).not.toHaveBeenCalled()
        expect(indexer.searchForTransactions).not.toHaveBeenCalled()
      }
    )
  })

  it('names a deleted application it has not seen from its creating transaction', async () => {
    const search = mockCreationSearch()
    const store = createStore()
    store.set(applicationResultsAtom, new Map([[escrowId, createReadOnlyAtomAndTimestamp(deletedApplicationResult())]]))

    return executeComponentTest(
      () => render(<ApplicationLink applicationId={escrowId} />, undefined, store),
      async (component) => {
        await waitFor(() => expect(component.getByText('Alpha Arcade order escrow')).toBeInTheDocument())
        expect(search.applicationID).toHaveBeenCalledWith(escrowId)
        // So other links to it are named straight away.
        expect(store.get(createdApplicationsAtom).has(escrowId)).toBe(true)
      }
    )
  })

  it('does not look up the creation of applications that still exist', async () => {
    const applicationResult = applicationResultBuilder().withId(escrowId).build()
    const store = createStore()
    store.set(applicationResultsAtom, new Map([[escrowId, createReadOnlyAtomAndTimestamp(applicationResult)]]))

    return executeComponentTest(
      () => render(<ApplicationLink applicationId={escrowId} />, undefined, store),
      async (component) => {
        await waitFor(() => expect(component.getByText(escrowId.toString())).toBeInTheDocument())
        expect(indexer.searchForTransactions).not.toHaveBeenCalled()
      }
    )
  })
})
