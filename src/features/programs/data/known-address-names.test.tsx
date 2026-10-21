import { describe, expect, it } from 'vitest'
import { atom, createStore } from 'jotai'
import { getApplicationAddress } from 'algosdk'
import { programAddress } from '@node-toolkit/core'
import { makeXChainProgram } from '@node-toolkit/programs/lsig'
import { executeComponentTest } from '@/tests/test-component'
import { render } from '@/tests/testing-library'
import { AccountLink } from '@/features/accounts/components/account-link'
import { mainnetId } from '@/features/network/data/types'
import { selectedNetworkAtomId, storedSelectedNetworkIdAtom } from '@/features/network/data'
import { settingsStore } from '@/features/settings/data'
import { TransactionResult } from '@/features/transactions/data/types'
import { addKnownLogicsigNames, knownLogicsigNamesAtom } from './known-address-names'

const xChainProgram = makeXChainProgram('0x4ca8000000000000000000000000000000c0e32e')
const xChainAddress = programAddress(xChainProgram)
const otherAddress = getApplicationAddress(1).toString()

const signedBy = (sender: string, logic?: Uint8Array) =>
  ({ id: sender, sender, signature: logic ? { logicsig: { logic } } : undefined }) as unknown as TransactionResult

const addAtom = atom(null, (_get, set, transactionResults: TransactionResult[]) => addKnownLogicsigNames(set, transactionResults))

describe('addKnownLogicsigNames', () => {
  it('names the logic signature accounts that signed', () => {
    const store = createStore()
    store.set(addAtom, [signedBy(xChainAddress, xChainProgram), signedBy(otherAddress)])

    const names = store.get(knownLogicsigNamesAtom)
    expect([...names.keys()]).toEqual([xChainAddress])
    expect(names.get(xChainAddress)?.[0]).toBe('xChain 0x4ca8…e32e')
  })

  it('skips delegated logic signatures, whose program is not the sender', () => {
    const store = createStore()
    store.set(addAtom, [signedBy(otherAddress, xChainProgram)])

    expect(store.get(knownLogicsigNamesAtom).size).toBe(0)
  })

  it('keeps the same map when nothing is new', () => {
    const store = createStore()
    store.set(addAtom, [signedBy(xChainAddress, xChainProgram)])
    const before = store.get(knownLogicsigNamesAtom)
    store.set(addAtom, [signedBy(xChainAddress, xChainProgram), signedBy(otherAddress)])

    expect(store.get(knownLogicsigNamesAtom)).toBe(before)
  })
})

describe('account-link', () => {
  it('shows a logic signature account Lora has seen by its name', async () => {
    const store = createStore()
    store.set(addAtom, [signedBy(xChainAddress, xChainProgram)])

    return executeComponentTest(
      () => render(<AccountLink address={xChainAddress} />, undefined, store),
      async (component) => {
        const name = component.getByText('xChain 0x4ca8…e32e')
        expect(name.getAttribute('title')).toBe(xChainAddress)
      }
    )
  })

  it('shows a known application account by its name', async () => {
    settingsStore.set(storedSelectedNetworkIdAtom, mainnetId)
    settingsStore.set(selectedNetworkAtomId)
    const address = getApplicationAddress(1002541853).toString()

    return executeComponentTest(
      () => render(<AccountLink address={address} />, undefined, createStore()),
      async (component) => {
        const name = component.getByText('Tinyman v2 validator account')
        expect(name.getAttribute('title')).toBe(address)
      }
    )
  })

  it('shows other accounts by their address', async () => {
    return executeComponentTest(
      () => render(<AccountLink address={otherAddress} />, undefined, createStore()),
      async (component) => {
        expect(component.getByText(otherAddress)).toBeInTheDocument()
      }
    )
  })
})
