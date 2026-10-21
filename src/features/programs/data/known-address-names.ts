import { useMemo } from 'react'
import { atom, Setter, useAtomValue } from 'jotai'
import { selectAtom } from 'jotai/utils'
import { programAddress } from '@node-toolkit/core'
import { createTimestamp } from '@/features/common/data/atom-cache'
import { useSelectedNetwork } from '@/features/network/data'
import { TransactionResult } from '@/features/transactions/data/types'
import { KnownLogicsig } from '../models'
import { asKnownApplicationAddressName, asKnownLogicsig, asKnownLogicsigAddressName } from '../mappers'

type Address = string

/**
 * Names of the logic signature accounts Lora has seen sign a transaction, by address.
 * A logic signature account's address is the hash of its program, so it can only be named once its program has been seen.
 */
export const knownLogicsigNamesAtom = atom(new Map<Address, readonly [string, number]>())

/** Remembers the name of a logic signature account, once its program is known. */
export const addKnownLogicsigName = (set: Setter, address: Address, knownLogicsig: KnownLogicsig) => {
  const name = asKnownLogicsigAddressName(knownLogicsig)
  if (name) {
    set(knownLogicsigNamesAtom, (prev) => (prev.get(address)?.[0] === name ? prev : new Map(prev).set(address, [name, createTimestamp()])))
  }
}

/**
 * Remembers the names of the logic signature accounts that signed these transactions.
 * Only programs that hash to the sender are the sender itself, which skips delegated logic signatures and rekeyed senders.
 */
export const addKnownLogicsigNames = (set: Setter, transactionResults: TransactionResult[]) => {
  set(knownLogicsigNamesAtom, (prev) => {
    let next: Map<Address, readonly [string, number]> | undefined
    transactionResults.forEach((transactionResult) => {
      const logic = transactionResult.signature?.logicsig?.logic
      const sender = String(transactionResult.sender)
      if (!logic || (next ?? prev).has(sender) || programAddress(logic) !== sender) {
        return
      }
      const name = asKnownLogicsigAddressName(asKnownLogicsig(logic))
      if (name) {
        next ??= new Map(prev)
        next.set(sender, [name, createTimestamp()])
      }
    })
    // Keep the same map when nothing is new, so nothing re-renders.
    return next ?? prev
  })
}

/**
 * A name to show in place of an address: a known application's account (e.g. `Tinyman v2 validator account`),
 * or a logic signature account Lora has already seen sign (e.g. `xChain 0x4ca8…e32e`).
 */
export const useKnownAddressName = (address: Address): string | undefined => {
  const [selectedNetwork] = useSelectedNetwork()
  const logicsigNameAtom = useMemo(() => selectAtom(knownLogicsigNamesAtom, (names) => names.get(address)?.[0]), [address])
  const logicsigName = useAtomValue(logicsigNameAtom)
  return useMemo(() => asKnownApplicationAddressName(address, selectedNetwork) ?? logicsigName, [address, selectedNetwork, logicsigName])
}
