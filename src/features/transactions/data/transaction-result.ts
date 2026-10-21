import { TransactionId, TransactionResult } from './types'
import { readOnlyAtomCache } from '@/features/common/data'
import { indexer } from '@/features/common/data/algo-client'
import { Getter, Setter } from 'jotai/index'
import { indexerTransactionToTransactionResult } from '../mappers/indexer-transaction-mappers'
import { addKnownLogicsigNames } from '@/features/programs/data/known-address-names'
import { addCreatedApplications } from '@/features/programs/data/known-application-names'

const getTransactionResult = (_: Getter, set: Setter, transactionId: TransactionId) =>
  indexer
    .lookupTransactionByID(transactionId)
    .do()
    .then((result) => {
      const transactionResult = indexerTransactionToTransactionResult(result.transaction)
      addKnownLogicsigNames(set, [transactionResult])
      addCreatedApplications(set, [transactionResult])
      return transactionResult
    })

const keySelector = (transactionId: TransactionId) => transactionId

export const [transactionResultsAtom, getTransactionResultAtom] = readOnlyAtomCache<
  Parameters<typeof keySelector>,
  ReturnType<typeof keySelector>,
  Promise<TransactionResult> | TransactionResult
>(getTransactionResult, keySelector)

export const getTransactionResultAtoms = (transactionIds: TransactionId[]) => {
  return transactionIds.map((transactionId) => getTransactionResultAtom(transactionId))
}
