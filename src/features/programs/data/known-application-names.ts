import { useMemo } from 'react'
import { atom, Getter, Setter, useAtomValue } from 'jotai'
import { loadable, selectAtom } from 'jotai/utils'
import { ApplicationId, ApplicationResult } from '@/features/applications/data/types'
import { getApplicationResultAtom } from '@/features/applications/data/application-result'
import { createTimestamp, readOnlyAtomCache } from '@/features/common/data/atom-cache'
import { indexer } from '@/features/common/data/algo-client'
import { useSelectedNetwork } from '@/features/network/data'
import { NetworkId } from '@/features/network/data/types'
import { TransactionResult } from '@/features/transactions/data/types'
import { indexerTransactionToTransactionResult } from '@/features/transactions/mappers/indexer-transaction-mappers'
import { CreatedApplication } from '../models'
import { asKnownApplicationIdName, asKnownApplicationName, asKnownCreatedApplicationName } from '../mappers'

/**
 * The applications Lora has seen created, by ID, from their creating transactions (top level or inner).
 * Many applications are short lived (e.g. Alpha Arcade order escrows are deleted once filled), and once deleted algod and indexer no longer return their programs or state.
 * Entries expire like Lora's other cached data, so this covers the window of recently loaded transactions.
 */
export const createdApplicationsAtom = atom(new Map<ApplicationId, readonly [CreatedApplication, number]>())

/** Remembers the applications these transactions (and their inner transactions) created. */
export const addCreatedApplications = (set: Setter, transactionResults: TransactionResult[]) => {
  set(createdApplicationsAtom, (prev) => {
    let next: Map<ApplicationId, readonly [CreatedApplication, number]> | undefined
    const visit = (transactionResult: TransactionResult) => {
      const createdApplicationId = transactionResult.createdApplicationIndex
      const applicationTransaction = transactionResult.applicationTransaction
      if (createdApplicationId && applicationTransaction) {
        const applicationId = BigInt(createdApplicationId)
        if (!(next ?? prev).has(applicationId)) {
          next ??= new Map(prev)
          next.set(applicationId, [
            {
              creator: String(transactionResult.sender),
              approvalProgram: applicationTransaction.approvalProgram,
              clearStateProgram: applicationTransaction.clearStateProgram,
              globalState: transactionResult.globalStateDelta ?? [],
            },
            createTimestamp(),
          ])
        }
      }
      transactionResult.innerTxns?.forEach(visit)
    }
    transactionResults.forEach(visit)
    // Keep the same map when nothing is new, so nothing re-renders.
    return next ?? prev
  })
}

// The first transaction indexer returns for an application is the one that created it (or whose inner transaction did).
const getApplicationCreation = async (get: Getter, set: Setter, applicationId: ApplicationId): Promise<CreatedApplication | null> => {
  const seen = get(createdApplicationsAtom).get(applicationId)
  if (seen) {
    return seen[0]
  }
  const result = await indexer.searchForTransactions().applicationID(applicationId).limit(1).do()
  addCreatedApplications(
    set,
    result.transactions.map((transaction) => indexerTransactionToTransactionResult(transaction))
  )
  return get(createdApplicationsAtom).get(applicationId)?.[0] ?? null
}

export const [applicationCreationsAtom, getApplicationCreationAtom] = readOnlyAtomCache<
  [ApplicationId],
  ApplicationId,
  Promise<CreatedApplication | null> | CreatedApplication | null
>(getApplicationCreation, (applicationId) => applicationId)

/**
 * A short name for a loaded application, or undefined.
 * A deleted application has no programs or state left, so it's named from its creating transaction instead (looked up if it wasn't seen).
 */
export const getKnownApplicationName = async (
  get: Getter,
  applicationResult: ApplicationResult,
  networkId: NetworkId
): Promise<string | undefined> => {
  const name = asKnownApplicationName(applicationResult, networkId)
  if (name !== undefined || !applicationResult.deleted) {
    return name
  }
  try {
    const createdApplication = await get(getApplicationCreationAtom(applicationResult.id))
    return createdApplication ? asKnownCreatedApplicationName(applicationResult.id, createdApplication, networkId) : undefined
  } catch {
    // Not knowing the name is fine
    return undefined
  }
}

/**
 * A name to show for an application (e.g. `Tinyman v2 validator`, `Alpha Arcade order escrow`), or undefined.
 * Known deployments are named from their ID, and applications Lora has seen created from their creating transaction, both straight away.
 * Other applications are loaded (and cached, as on the application page), so apps known by their creator, global state or program get a name once they have loaded.
 */
export const useKnownApplicationName = (applicationId: ApplicationId): string | undefined => {
  const [selectedNetwork] = useSelectedNetwork()
  const idName = useMemo(() => asKnownApplicationIdName(applicationId, selectedNetwork), [applicationId, selectedNetwork])
  const createdApplicationAtom = useMemo(
    () => selectAtom(createdApplicationsAtom, (createdApplications) => createdApplications.get(applicationId)?.[0]),
    [applicationId]
  )
  const createdApplication = useAtomValue(createdApplicationAtom)
  const createdName = useMemo(
    () => (createdApplication ? asKnownCreatedApplicationName(applicationId, createdApplication, selectedNetwork) : undefined),
    [applicationId, createdApplication, selectedNetwork]
  )
  const nameAtom = useMemo(
    () =>
      loadable(
        atom(async (get) => {
          if (idName !== undefined || createdName !== undefined) {
            return undefined
          }
          const applicationResult = await get(getApplicationResultAtom(applicationId))
          return getKnownApplicationName(get, applicationResult, selectedNetwork)
        })
      ),
    [applicationId, selectedNetwork, idName, createdName]
  )
  const loadableName = useAtomValue(nameAtom)
  return idName ?? createdName ?? (loadableName.state === 'hasData' ? loadableName.data : undefined)
}
