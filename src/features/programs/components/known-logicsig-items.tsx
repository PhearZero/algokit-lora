import { encodeAddress } from 'algosdk'
import { ProgramMatch } from '@node-toolkit/programs/lsig'
import { CopyButton } from '@/features/common/components/copy-button'
import { AccountLink } from '@/features/accounts/components/account-link'
import { ApplicationLink } from '@/features/applications/components/application-link'
import { AssetIdLink } from '@/features/assets/components/asset-link'
import { uint8ArrayToBase64 } from '@/utils/uint8-array-to-base64'
import { KnownLogicsig } from '../models'
import {
  logicsigAdminLabel,
  logicsigApplicationLabel,
  logicsigAsset1Label,
  logicsigAsset2Label,
  logicsigAssetLabel,
  logicsigEd25519AccountLabel,
  logicsigEvmAddressLabel,
  logicsigFalconCounterLabel,
  logicsigFalconPublicKeyLabel,
  logicsigKnownAsLabel,
  logicsigLinkedAccountLabel,
  logicsigMaxGroupSizeLabel,
  logicsigNfdLabel,
  logicsigOrderBookLabel,
  logicsigOwnerLabel,
  logicsigPriceLabel,
  logicsigRegistryLabel,
  logicsigTemplateIdLabel,
  logicsigValidatorLabel,
} from './labels'

const asAssetLink = (assetId: number) => (assetId === 0 ? 'ALGO' : <AssetIdLink assetId={BigInt(assetId)} showCopyButton={true} />)

const asCopyableValue = (value: string, className = 'truncate') => (
  <div className="flex items-center">
    <span className={className}>{value}</span>
    <CopyButton value={value} />
  </div>
)

const asMatchItems = (match: ProgramMatch) => {
  switch (match.kind) {
    case 'falcon':
      return [
        { dt: logicsigFalconPublicKeyLabel, dd: asCopyableValue(uint8ArrayToBase64(match.falcon1024PK), 'break-all') },
        { dt: logicsigFalconCounterLabel, dd: match.counter },
      ]
    case 'hybrid':
      return [
        { dt: logicsigEd25519AccountLabel, dd: <AccountLink address={encodeAddress(match.ed25519PK)} showCopyButton={true} /> },
        { dt: logicsigFalconPublicKeyLabel, dd: asCopyableValue(uint8ArrayToBase64(match.falcon1024PK), 'break-all') },
      ]
    case 'xchain':
      return [{ dt: logicsigEvmAddressLabel, dd: asCopyableValue(match.evmAddress) }]
    case 'algodex':
      return [
        { dt: logicsigOwnerLabel, dd: <AccountLink address={match.params.owner} showCopyButton={true} /> },
        { dt: logicsigAssetLabel, dd: asAssetLink(match.params.assetId) },
        { dt: logicsigPriceLabel, dd: `${match.params.n} / ${match.params.d}` },
        { dt: logicsigOrderBookLabel, dd: <ApplicationLink applicationId={BigInt(match.params.appId)} showCopyButton={true} /> },
      ]
    case 'tinyman':
      return [
        { dt: logicsigValidatorLabel, dd: <ApplicationLink applicationId={BigInt(match.params.validatorAppId)} showCopyButton={true} /> },
        { dt: logicsigAsset1Label, dd: asAssetLink(match.params.asset1Id) },
        { dt: logicsigAsset2Label, dd: asAssetLink(match.params.asset2Id) },
      ]
    case 'folks':
      return [{ dt: logicsigOwnerLabel, dd: <AccountLink address={match.params.owner} showCopyButton={true} /> }]
    case 'algoland':
      return [
        { dt: logicsigApplicationLabel, dd: <ApplicationLink applicationId={BigInt(match.params.appId)} showCopyButton={true} /> },
        { dt: logicsigAdminLabel, dd: <AccountLink address={match.params.admin} showCopyButton={true} /> },
        { dt: logicsigMaxGroupSizeLabel, dd: match.params.maxGroupSize },
      ]
    case 'nfd':
      return [
        match.params.lookup === 'name'
          ? { dt: logicsigNfdLabel, dd: asCopyableValue(match.params.name) }
          : { dt: logicsigLinkedAccountLabel, dd: <AccountLink address={match.params.address} showCopyButton={true} /> },
        { dt: logicsigRegistryLabel, dd: <ApplicationLink applicationId={BigInt(match.params.registryAppId)} showCopyButton={true} /> },
      ]
    default:
      return []
  }
}

/**
 * Description list items for a logic signature: what it's known as, the signers and parameters embedded in the program, and its template ID.
 * Used by the transaction logicsig card and the account page, so both show the same thing.
 */
export const asKnownLogicsigItems = (knownLogicsig: KnownLogicsig) => [
  ...(knownLogicsig.name ? [{ dt: logicsigKnownAsLabel, dd: knownLogicsig.name }] : []),
  ...(knownLogicsig.match ? asMatchItems(knownLogicsig.match) : []),
  { dt: logicsigTemplateIdLabel, dd: asCopyableValue(knownLogicsig.templateId) },
]
