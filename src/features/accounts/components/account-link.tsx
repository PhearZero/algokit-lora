import { useLoadableReverseLookupNfdResult } from '@/features/nfd/data'
import { RenderLoadable } from '@/features/common/components/render-loadable'
import { useKnownAddressName } from '@/features/programs/data/known-address-names'
import { AddressOrNfdLink, AddressOrNfdLinkProps } from './address-or-nfd-link'

export type Props = Omit<AddressOrNfdLinkProps, 'nfd'>

export const AccountLink = ({ address, ...rest }: Props) => {
  const loadableNfd = useLoadableReverseLookupNfdResult(address.toString())
  // Known application accounts and logic signature accounts are named the same way as NFDs, unless they have an NFD.
  const knownName = useKnownAddressName(address.toString())

  return (
    <>
      <RenderLoadable loadable={loadableNfd} fallback={<AddressOrNfdLink address={address} nfd={knownName} {...rest} />}>
        {(nfd) => <AddressOrNfdLink address={address} nfd={nfd?.name ?? knownName} {...rest} />}
      </RenderLoadable>
    </>
  )
}
