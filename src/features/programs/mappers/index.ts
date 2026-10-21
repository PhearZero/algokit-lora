import { NETWORK_IDS, NetworkId as ToolkitNetworkId, templateId } from '@node-toolkit/core'
import { appMatchLabel, knownApp, knownAppByAddress, matchApp } from '@node-toolkit/programs/app'
import { matchProgram, ProgramMatch } from '@node-toolkit/programs/lsig'
import { ApplicationResult } from '@/features/applications/data/types'
import { NetworkId } from '@/features/network/data/types'
import { base64ToBytes } from '@/utils/base64-to-bytes'
import { CreatedApplication, KnownLogicsig } from '../models'

const asToolkitNetworkId = (networkId: NetworkId): ToolkitNetworkId | undefined =>
  (NETWORK_IDS as readonly string[]).includes(networkId) ? (networkId as ToolkitNetworkId) : undefined

const asLogicsigName = (match: ProgramMatch): string => {
  switch (match.kind) {
    case 'falcon':
      return 'Falcon-1024 account'
    case 'hybrid':
      return 'Hybrid Ed25519 + Falcon-1024 account'
    case 'xchain':
      return 'xChain EVM account'
    case 'algodex':
      return `AlgoDex ${match.params.side} order escrow`
    case 'tinyman':
      return `Tinyman ${match.params.release ?? `v${match.params.version}`} pool`
    case 'folks':
      return 'Folks Finance liquid governance escrow'
    case 'algoland':
      return 'Algoland fee sponsor'
    case 'nfd':
      return match.params.lookup === 'name' ? 'NFD name lookup' : 'NFD reverse address lookup'
    case 'dummy':
      return 'Falcon CLI budget filler'
    case 'heartbeat':
      return 'Node heartbeat'
    case 'pennybank':
      return 'Pennybank app caller'
  }
}

/**
 * Recognises a logic signature program offline, using @node-toolkit/programs.
 * The template ID is the program with its constants left out, hashed, so it's the same for every program built from one template.
 * It's a grouping heuristic only: anyone can build a program from a known template with their own values.
 */
export const asKnownLogicsig = (logic: string | Uint8Array): KnownLogicsig => {
  const program = typeof logic === 'string' ? base64ToBytes(logic) : logic
  const result = matchProgram(program)
  return {
    templateId: templateId(program),
    ...(result ? { matcherId: result.matcher.id, name: asLogicsigName(result.match), match: result.match } : {}),
  }
}

/**
 * A short name to show in place of a logic signature account's address (e.g. `xChain 0x4ca8…e32e`, `Tinyman v2 pool`),
 * or undefined if the program isn't recognised.
 */
export const asKnownLogicsigAddressName = (knownLogicsig: KnownLogicsig): string | undefined => {
  const match = knownLogicsig.match
  switch (match?.kind) {
    case 'xchain':
      return `xChain ${match.evmAddress.slice(0, 6)}…${match.evmAddress.slice(-4)}`
    case 'hybrid':
      return 'Hybrid account'
    case 'nfd':
      return match.params.lookup === 'name' ? `NFD lookup ${match.params.name}` : 'NFD reverse lookup'
    default:
      return knownLogicsig.name
  }
}

/** The known application whose account this address is (e.g. `Tinyman v2 validator`), or undefined. */
export const asKnownApplicationAccount = (address: string, networkId: NetworkId) => {
  const network = asToolkitNetworkId(networkId)
  const known = network ? knownAppByAddress(network, address) : undefined
  return known ? { applicationId: BigInt(known.appId), name: appMatchLabel(known.match) } : undefined
}

/** A short name to show in place of a known application's account address (e.g. `Tinyman v2 validator account`), or undefined. */
export const asKnownApplicationAddressName = (address: string, networkId: NetworkId): string | undefined => {
  const known = asKnownApplicationAccount(address, networkId)
  return known ? `${known.name} account` : undefined
}

/** The name of a known deployment from its ID alone (e.g. `Tinyman v2 validator`), without loading the application. */
export const asKnownApplicationIdName = (applicationId: bigint | number, networkId: NetworkId): string | undefined => {
  const network = asToolkitNetworkId(networkId)
  const known = network ? knownApp(network, applicationId) : undefined
  return known ? appMatchLabel(known.match) : undefined
}

/** A short name for a known application (e.g. `Tinyman v2 validator`), or undefined if the application isn't recognised. */
export const asKnownApplicationName = (application: ApplicationResult, networkId: NetworkId): string | undefined => {
  const result = matchApp({
    appId: application.id,
    network: asToolkitNetworkId(networkId),
    creator: application.params.creator,
    approvalProgram: application.params.approvalProgram,
    clearStateProgram: application.params.clearStateProgram,
    globalState: application.params.globalState,
  })
  return result ? appMatchLabel(result.match) : undefined
}

// Eval delta actions: 1 sets bytes, 2 sets a uint, 3 deletes.
const deltaActionSetUint = 2
const deltaActionDelete = 3

/** A short name for an application from its creating transaction, or undefined if it isn't recognised. */
export const asKnownCreatedApplicationName = (
  applicationId: bigint,
  createdApplication: CreatedApplication,
  networkId: NetworkId
): string | undefined => {
  const result = matchApp({
    appId: applicationId,
    network: asToolkitNetworkId(networkId),
    creator: createdApplication.creator,
    approvalProgram: createdApplication.approvalProgram,
    clearStateProgram: createdApplication.clearStateProgram,
    globalState: createdApplication.globalState
      .filter(({ value }) => value.action !== deltaActionDelete)
      .map(({ key, value }) => ({
        key,
        value: { type: value.action === deltaActionSetUint ? 2 : 1, bytes: value.bytes, uint: value.uint },
      })),
  })
  return result ? appMatchLabel(result.match) : undefined
}
