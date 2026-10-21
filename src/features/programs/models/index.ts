import { ProgramMatch } from '@node-toolkit/programs/lsig'
import { EvalDeltaKeyValue } from '@/features/transactions/data/types'

export type KnownLogicsig = {
  templateId: string
  matcherId?: string
  name?: string
  match?: ProgramMatch
}

/**
 * What an application's creating transaction says about it.
 * Kept so applications that are deleted soon after (e.g. filled order escrows) can still be named, as algod and indexer drop their programs and state.
 */
export type CreatedApplication = {
  creator: string
  approvalProgram?: Uint8Array
  clearStateProgram?: Uint8Array
  /** The global state set when it was created. */
  globalState: EvalDeltaKeyValue[]
}
