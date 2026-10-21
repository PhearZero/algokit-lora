import { describe, expect, it } from 'vitest'
import { getApplicationAddress } from 'algosdk'
import { makeNfdLookupProgram, makeXChainProgram } from '@node-toolkit/programs/lsig'
import {
  asKnownApplicationAccount,
  asKnownApplicationAddressName,
  asKnownApplicationName,
  asKnownLogicsig,
  asKnownLogicsigAddressName,
} from '.'
import { uint8ArrayToBase64 } from '@/utils/uint8-array-to-base64'
import { ApplicationResult } from '@/features/applications/data/types'
import { mainnetId, testnetId } from '@/features/network/data/types'

const applicationResult = (id: bigint) => ({ id, params: {} }) as unknown as ApplicationResult

describe('asKnownLogicsig', () => {
  it('recognises an xChain account and decodes its EVM address', () => {
    const evmAddress = '0x1111111111111111111111111111111111111111'
    const result = asKnownLogicsig(uint8ArrayToBase64(makeXChainProgram(evmAddress)))

    expect(result.matcherId).toBe('xchain/v1')
    expect(result.name).toBe('xChain EVM account')
    expect(result.match).toEqual({ kind: 'xchain', evmAddress })
    expect(result.templateId).toMatch(/^[0-9a-f]{16}$/)
  })

  it('gives programs from one template the same template ID', () => {
    const a = asKnownLogicsig(uint8ArrayToBase64(makeXChainProgram('0x1111111111111111111111111111111111111111')))
    const b = asKnownLogicsig(uint8ArrayToBase64(makeXChainProgram('0x2222222222222222222222222222222222222222')))

    expect(a.templateId).toBe(b.templateId)
  })

  it('recognises NFD registry lookup accounts', () => {
    const result = asKnownLogicsig(makeNfdLookupProgram({ name: 'nfdomains.algo' }))

    expect(result.matcherId).toBe('nfd/lookup-v1')
    expect(result.name).toBe('NFD name lookup')
    expect(result.match).toEqual({
      kind: 'nfd',
      params: { registryAppId: 760937186, network: 'mainnet', lookup: 'name', name: 'nfdomains.algo' },
    })
  })

  it('only returns a template ID for an unknown program', () => {
    // #pragma version 8; pushint 1; return
    expect(asKnownLogicsig('CIEBQw==')).toEqual({ templateId: expect.stringMatching(/^[0-9a-f]{16}$/) })
  })
})

describe('asKnownApplicationName', () => {
  it('names a known application on its network', () => {
    expect(asKnownApplicationName(applicationResult(1002541853n), mainnetId)).toBe('Tinyman v2 validator')
    expect(asKnownApplicationName(applicationResult(354073718n), mainnetId)).toBe('AlgoDex buy order book')
  })

  it('names NFD instances from their global state', () => {
    const utf8 = (value: string) => new TextEncoder().encode(value)
    const asaId = new Uint8Array(8)
    new DataView(asaId.buffer).setBigUint64(0, 763843618n)
    const globalState = [
      { key: utf8('i.name'), value: { type: 1, bytes: utf8('patrick.algo'), uint: 0n } },
      { key: utf8('i.ver'), value: { type: 1, bytes: utf8('3.7'), uint: 0n } },
      { key: utf8('i.owner.a'), value: { type: 1, bytes: new Uint8Array(32).fill(7), uint: 0n } },
      { key: utf8('i.asaid'), value: { type: 1, bytes: asaId, uint: 0n } },
    ]
    const application = { id: 763843612n, params: { globalState } } as unknown as ApplicationResult

    expect(asKnownApplicationName(application, mainnetId)).toBe('NFD patrick.algo')
    expect(asKnownApplicationName(applicationResult(760937186n), mainnetId)).toBe('NFD registry')
  })

  it('names protocol deployments by ID, and their child apps by creator', () => {
    expect(asKnownApplicationName(applicationResult(971368268n), mainnetId)).toBe('Folks Finance ALGO pool')
    expect(asKnownApplicationName(applicationResult(842125965n), mainnetId)).toBe('Wormhole core bridge')
    expect(asKnownApplicationName(applicationResult(1284326447n), mainnetId)).toBe('Orange (ORA) mining')
    // A Réti staking pool, created by the validator registry (2714516089).
    const pool = { id: 2714622967n, params: { creator: getApplicationAddress(2714516089n) } } as unknown as ApplicationResult
    expect(asKnownApplicationName(pool, mainnetId)).toBe('Réti staking pool')
    expect(asKnownApplicationName(applicationResult(3569556034n), mainnetId)).toBe('Akita DAO')
    expect(asKnownApplicationName(applicationResult(3172554435n), mainnetId)).toBe('Haystack router')
    expect(asKnownApplicationName(applicationResult(3628061142n), mainnetId)).toBe('ZeroSignal escrow')
    // An Akita wallet, created by the wallet factory (3569556257).
    const wallet = { id: 3570353317n, params: { creator: getApplicationAddress(3569556257n) } } as unknown as ApplicationResult
    expect(asKnownApplicationName(wallet, mainnetId)).toBe('Akita wallet')
  })

  it('names Alpha Arcade markets by their creator account, only when they have the market globals', () => {
    const key = (k: string) => ({ key: new TextEncoder().encode(k), value: { type: 2, uint: 1n } })
    const market = (globalState: unknown[]) =>
      ({
        id: 3748955733n,
        params: { creator: '5P5Y6HTWUNG2E3VXBQDZN3ENZD3JPAIR5PKT3LOYJAPAUKOLFD6KANYTRY', globalState },
      }) as unknown as ApplicationResult
    expect(asKnownApplicationName(market(['collateral_asset_id', 'yes_asset_id', 'no_asset_id'].map(key)), mainnetId)).toBe(
      'Alpha Arcade market'
    )
    expect(asKnownApplicationName(market([]), mainnetId)).toBeUndefined()
  })

  it('does not name a known application ID on another network', () => {
    expect(asKnownApplicationName(applicationResult(1002541853n), testnetId)).toBeUndefined()
  })

  it('does not name applications on a custom network', () => {
    expect(asKnownApplicationName(applicationResult(1002541853n), 'my-custom-network')).toBeUndefined()
  })
})

describe('asKnownLogicsigAddressName', () => {
  it('names logic signature accounts in a short form', () => {
    const xChain = asKnownLogicsig(makeXChainProgram('0x4ca8000000000000000000000000000000c0e32e'))
    const nfd = asKnownLogicsig(makeNfdLookupProgram({ name: 'nfdomains.algo' }))

    expect(asKnownLogicsigAddressName(xChain)).toBe('xChain 0x4ca8…e32e')
    expect(asKnownLogicsigAddressName(nfd)).toBe('NFD lookup nfdomains.algo')
  })

  it('does not name unknown programs', () => {
    expect(asKnownLogicsigAddressName(asKnownLogicsig(Uint8Array.from([0x0a, 0x81, 0x01])))).toBeUndefined()
  })
})

describe('asKnownApplicationAddressName', () => {
  it('names a known application account on its network', () => {
    const address = getApplicationAddress(1002541853).toString()

    expect(asKnownApplicationAddressName(address, mainnetId)).toBe('Tinyman v2 validator account')
    expect(asKnownApplicationAccount(address, mainnetId)).toEqual({ applicationId: 1002541853n, name: 'Tinyman v2 validator' })
    expect(asKnownApplicationAddressName(address, testnetId)).toBeUndefined()
    expect(asKnownApplicationAddressName(address, 'custom')).toBeUndefined()
  })
})
