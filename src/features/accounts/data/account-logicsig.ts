import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { loadable } from 'jotai/utils'
import { programAddress } from '@node-toolkit/core'
import { indexerModels } from 'algosdk'
import { AccountSignatureType, Address } from './types'
import { readOnlyAtomCache } from '@/features/common/data'
import { indexer } from '@/features/common/data/algo-client'
import { KnownLogicsig } from '@/features/programs/models'
import { asKnownLogicsig } from '@/features/programs/mappers'
import { getAccountSignatureTypeAtom } from './account-signature-type'
import { addKnownLogicsigName } from '@/features/programs/data/known-address-names'

// Only programs that hash to the account's own address are the account itself.
// This skips delegated logic signatures and programs an account is rekeyed to.
const findAccountProgram = (address: Address, transactions: indexerModels.Transaction[]) =>
  transactions
    .map((transaction) => transaction.signature?.logicsig?.logic)
    .find((logic): logic is Uint8Array => logic !== undefined && programAddress(logic) === address)

const getAccountLogicsig = async (
  address: Address,
  isRekeyed: boolean,
  signatureType: Promise<AccountSignatureType | null> | AccountSignatureType | null
): Promise<KnownLogicsig | null> => {
  // An account's address is the hash of its program, so the program can't be read back from the account.
  // It's only known once the account has signed a transaction with it, so it's loaded from the indexer.
  if ((await signatureType) === 'lsig') {
    const result = await indexer.searchForTransactions().address(address).addressRole('sender').sigType('lsig').limit(1).do()
    const program = findAccountProgram(address, result.transactions)
    return program ? asKnownLogicsig(program) : null
  }

  // The indexer clears the signature type when an account is rekeyed, which is how many protocol escrows work (e.g. Tinyman v2 pools).
  // These accounts usually sign their opt in and rekey with their program in the round they are created, so only that round is searched.
  if (isRekeyed) {
    const { account } = await indexer.lookupAccountByID(address).exclude('all').do()
    if (account.createdAtRound === undefined) {
      return null
    }
    const result = await indexer
      .searchForTransactions()
      .address(address)
      .addressRole('sender')
      .minRound(account.createdAtRound)
      .maxRound(account.createdAtRound)
      .do()
    const program = findAccountProgram(address, result.transactions)
    return program ? asKnownLogicsig(program) : null
  }

  return null
}

const keySelector = (address: Address, _isRekeyed: boolean) => address

export const [accountLogicsigsAtom, getAccountLogicsigAtom] = readOnlyAtomCache<
  Parameters<typeof keySelector>,
  ReturnType<typeof keySelector>,
  Promise<KnownLogicsig | null> | KnownLogicsig | null
>(async (get, set, address, isRekeyed) => {
  const knownLogicsig = await getAccountLogicsig(address, isRekeyed, get(getAccountSignatureTypeAtom(address)))
  // So links to this account elsewhere show what it is too.
  if (knownLogicsig) {
    addKnownLogicsigName(set, address, knownLogicsig)
  }
  return knownLogicsig
}, keySelector)

export const useLoadableAccountLogicsig = (address: Address, isRekeyed: boolean) => {
  const accountLogicsigAtom = useMemo(() => {
    return getAccountLogicsigAtom(address, isRekeyed)
  }, [address, isRekeyed])
  return useAtomValue(loadable(accountLogicsigAtom))
}
