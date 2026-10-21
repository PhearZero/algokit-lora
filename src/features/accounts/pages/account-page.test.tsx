import { executeComponentTest } from '@/tests/test-component'
import { render, renderHook, waitFor } from '@/tests/testing-library'
import { useParams } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AccountPage, accountFailedToLoadMessage } from './account-page'
import { createReadOnlyAtomAndTimestamp } from '@/features/common/data'
import { accountResultMother } from '@/tests/object-mother/account-result'
import { createStore } from 'jotai'
import { descriptionListAssertion } from '@/tests/assertions/description-list-assertion'
import { getByDescriptionTerm, queryByDescriptionTerm } from '@/tests/custom-queries/get-description'
import { encodeAddress } from 'algosdk'
import { accountResultsAtom, accountSignatureTypesAtom } from '../data'
import {
  accountAddressLabel,
  accountBalanceLabel,
  accountApplicationsCreatedLabel,
  accountAssetsCreatedLabel,
  accountAssetsHeldLabel,
  accountInformationLabel,
  accountMinBalanceLabel,
  accountApplicationsOptedInLabel,
  accountAssetsOptedInLabel,
  accountActivityLabel,
  accountRekeyedToLabel,
  accountAssetLabel,
  accountApplicationLabel,
  accountNfdLabel,
  accountSignatureTypeLabel,
} from '../components/labels'
import { assetResultsAtom } from '@/features/assets/data'
import { assetResultMother } from '@/tests/object-mother/asset-result'
import { refreshButtonLabel } from '@/features/common/components/refresh-button'
import { algod, indexer } from '@/features/common/data/algo-client'
import { nfdResultMother } from '@/tests/object-mother/nfd-result'
import { atom } from 'jotai'
import { forwardNfdResultsAtom, reverseNfdsAtom } from '@/features/nfd/data'
import { defaultNetworkConfigs, localnetId, useSetCustomNetworkConfig } from '@/features/network/data'
import { programAddress } from '@node-toolkit/core'
import { makeHybridProgram, makeXChainProgram } from '@node-toolkit/programs/lsig'
import {
  logicsigEd25519AccountLabel,
  logicsigEvmAddressLabel,
  logicsigKnownAsLabel,
  logicsigTemplateIdLabel,
} from '@/features/programs/components/labels'

const mockLogicsigSearch = (logic?: Uint8Array) => {
  const search = {
    address: vi.fn(),
    addressRole: vi.fn(),
    sigType: vi.fn(),
    limit: vi.fn(),
    minRound: vi.fn(),
    maxRound: vi.fn(),
    do: vi.fn().mockResolvedValue({ transactions: logic ? [{ signature: { logicsig: { logic } } }] : [] }),
  }
  search.address.mockReturnValue(search)
  search.addressRole.mockReturnValue(search)
  search.sigType.mockReturnValue(search)
  search.limit.mockReturnValue(search)
  search.minRound.mockReturnValue(search)
  search.maxRound.mockReturnValue(search)
  vi.mocked(indexer.searchForTransactions).mockReturnValue(search as unknown as ReturnType<typeof indexer.searchForTransactions>)
  return search
}

vi.mock('@/features/common/data/algo-client', async () => {
  const original = await vi.importActual('@/features/common/data/algo-client')
  return {
    ...original,
    algod: {
      accountInformation: vi.fn(),
    },
    indexer: {
      lookupAccountByID: vi.fn().mockReturnValue({
        exclude: vi.fn().mockReturnValue({
          do: vi.fn().mockResolvedValue({ account: {} }),
        }),
      }),
      searchForTransactions: vi.fn(),
    },
  }
})

describe('account-page', () => {
  describe('when rendering an account using a invalid address', () => {
    it('should render an error message', () => {
      vi.mocked(useParams).mockReturnValue({ address: 'invalid-address' })

      return executeComponentTest(
        () => render(<AccountPage />),
        async (component) => {
          await waitFor(() => expect(component.getByText('Address is invalid')).toBeTruthy())
        }
      )
    })
  })

  describe('when rendering an account that failed to load', () => {
    it('should render an error message', () => {
      vi.mocked(useParams).mockReturnValue({ address: '7AHHR4ZMHKMRFUVGLU3SWGKMJBKRUA5UQQUPFWT4WMFO2RLXBUIXZR7FQQ' })
      vi.mocked(algod.accountInformation).mockRejectedValue({})

      return executeComponentTest(
        () => render(<AccountPage />),
        async (component) => {
          await waitFor(() => expect(component.getByText(accountFailedToLoadMessage)).toBeTruthy())
        }
      )
    })
  })

  describe('when rendering an account', () => {
    const accountResult = accountResultMother['mainnet-BIQXAK67KSCKN3EJXT4S3RVXUBFOLZ45IQOBTSOQWOSR4LLULBTD54S5IA']().build()
    const assetResults = new Map([
      [924268058n, createReadOnlyAtomAndTimestamp(assetResultMother['mainnet-924268058']().build())],
      [1010208883n, createReadOnlyAtomAndTimestamp(assetResultMother['mainnet-1010208883']().build())],
      [1096015467n, createReadOnlyAtomAndTimestamp(assetResultMother['mainnet-1096015467']().build())],
    ])

    it('should be rendered with the correct data', () => {
      const myStore = createStore()
      myStore.set(accountResultsAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(accountResult)]]))
      myStore.set(assetResultsAtom, assetResults)

      vi.mocked(useParams).mockImplementation(() => ({ address: accountResult.address }))

      return executeComponentTest(
        () => render(<AccountPage />, undefined, myStore),
        async (component) => {
          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            descriptionListAssertion({
              container: informationCard,
              items: [
                { term: accountAddressLabel, description: 'BIQXAK67KSCKN3EJXT4S3RVXUBFOLZ45IQOBTSOQWOSR4LLULBTD54S5IA' },
                { term: accountBalanceLabel, description: '5.883741' },
                { term: accountMinBalanceLabel, description: '0.7' },
                { term: accountAssetsHeldLabel, description: '1' },
                { term: accountAssetsCreatedLabel, description: '0' },
                { term: accountAssetsOptedInLabel, description: '3' },
                { term: accountApplicationsCreatedLabel, description: '0' },
                { term: accountApplicationsOptedInLabel, description: '2' },
              ],
            })
            const activityTabList = component.getByRole('tablist', { name: accountActivityLabel })
            expect(activityTabList).toBeTruthy()
            expect(activityTabList.children.length).toBe(2)

            const assetTabList = component.getByRole('tablist', { name: accountAssetLabel })
            expect(assetTabList).toBeTruthy()
            expect(assetTabList.children.length).toBe(3)

            const applicationTabList = component.getByRole('tablist', { name: accountApplicationLabel })
            expect(applicationTabList).toBeTruthy()
            expect(applicationTabList.children.length).toBe(2)
          })

          // The indexer reports no signature type for this account, so the row is not shown
          await waitFor(() => expect(indexer.lookupAccountByID).toHaveBeenCalledWith(accountResult.address))
          const informationCard = component.getByLabelText(accountInformationLabel)
          expect(queryByDescriptionTerm(informationCard, accountSignatureTypeLabel)).toBeNull()
        }
      )
    })
  })

  describe('when rendering an account with assets and applications', () => {
    const accountResult = accountResultMother['mainnet-ORANGESCU7XMR2TFXSFTOHCUHNP6OYEPIKZW3JZANTCDHVQYMGQFYFIDDA']().build()
    const assetResults = new Map([
      [1336655079n, createReadOnlyAtomAndTimestamp(accountResult.createdAssets![0])],
      [1284444444n, createReadOnlyAtomAndTimestamp(assetResultMother['mainnet-1284444444']().build())],
      [1162292622n, createReadOnlyAtomAndTimestamp(assetResultMother['mainnet-1162292622']().build())],
      [1294765516n, createReadOnlyAtomAndTimestamp(assetResultMother['mainnet-1294765516']().build())],
      [1355858325n, createReadOnlyAtomAndTimestamp(assetResultMother['mainnet-1355858325']().build())],
      [1355898842n, createReadOnlyAtomAndTimestamp(assetResultMother['mainnet-1355898842']().build())],
    ])

    it('should be rendered with the correct data', () => {
      const myStore = createStore()
      myStore.set(accountResultsAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(accountResult)]]))
      myStore.set(assetResultsAtom, assetResults)

      vi.mocked(useParams).mockImplementation(() => ({ address: accountResult.address }))

      return executeComponentTest(
        () => render(<AccountPage />, undefined, myStore),
        async (component) => {
          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            descriptionListAssertion({
              container: informationCard,
              items: [
                { term: accountAddressLabel, description: 'ORANGESCU7XMR2TFXSFTOHCUHNP6OYEPIKZW3JZANTCDHVQYMGQFYFIDDA' },
                { term: accountBalanceLabel, description: '123.714752' },
                { term: accountMinBalanceLabel, description: '5.281' },
                { term: accountAssetsHeldLabel, description: '5' },
                { term: accountAssetsCreatedLabel, description: '1' },
                { term: accountAssetsOptedInLabel, description: '6' },
                { term: accountApplicationsCreatedLabel, description: '4' },
                { term: accountApplicationsOptedInLabel, description: '1' },
              ],
            })
            const activityTabList = component.getByRole('tablist', { name: accountActivityLabel })
            expect(activityTabList).toBeTruthy()
            expect(activityTabList.children.length).toBe(2)

            const assetTabList = component.getByRole('tablist', { name: accountAssetLabel })
            expect(assetTabList).toBeTruthy()
            expect(assetTabList.children.length).toBe(3)

            const applicationTabList = component.getByRole('tablist', { name: accountApplicationLabel })
            expect(applicationTabList).toBeTruthy()
            expect(applicationTabList.children.length).toBe(2)
          })
        }
      )
    })
  })

  describe('when rendering an account with rekey', () => {
    const accountResult = accountResultMother['mainnet-DGOANM6JL4VNSBJW737T24V4WVQINFWELRE3OKHQQFZ2JFMVKUF52D4AY4']().build()

    it('should be rendered with the correct data', () => {
      const myStore = createStore()
      myStore.set(accountResultsAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(accountResult)]]))

      vi.mocked(useParams).mockImplementation(() => ({ address: accountResult.address }))

      return executeComponentTest(
        () => render(<AccountPage />, undefined, myStore),
        async (component) => {
          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            descriptionListAssertion({
              container: informationCard,
              items: [
                { term: accountAddressLabel, description: 'DGOANM6JL4VNSBJW737T24V4WVQINFWELRE3OKHQQFZ2JFMVKUF52D4AY4' },
                { term: accountRekeyedToLabel, description: 'K7F3GQNOXIMJFF2NJSBHZ7OPNWVLIJM3BN6CYAZJBY3MS6C7TN24JTYX5E' },
                { term: accountBalanceLabel, description: '98.433606' },
                { term: accountMinBalanceLabel, description: '2.2285' },
                { term: accountAssetsHeldLabel, description: '0' },
                { term: accountAssetsCreatedLabel, description: '0' },
                { term: accountAssetsOptedInLabel, description: '0' },
                { term: accountApplicationsCreatedLabel, description: '0' },
                { term: accountApplicationsOptedInLabel, description: '8' },
              ],
            })
            const activityTabList = component.getByRole('tablist', { name: accountActivityLabel })
            expect(activityTabList).toBeTruthy()
            expect(activityTabList.children.length).toBe(2)

            const assetTabList = component.getByRole('tablist', { name: accountAssetLabel })
            expect(assetTabList).toBeTruthy()
            expect(assetTabList.children.length).toBe(3)

            const applicationTabList = component.getByRole('tablist', { name: accountApplicationLabel })
            expect(applicationTabList).toBeTruthy()
            expect(applicationTabList.children.length).toBe(2)
          })
        }
      )
    })
  })

  describe('when rendering an account with a post-quantum signature type', () => {
    const accountResult = accountResultMother['mainnet-DHMCHBN4W5MBO72C3L3ZP6GGJHQ4OR6SW2EP3VDEJ5VHT4MERQLCTVW6PU']().build()

    it('should be rendered with the signature type', () => {
      const myStore = createStore()
      myStore.set(accountResultsAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(accountResult)]]))
      myStore.set(accountSignatureTypesAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp('pqsig' as const)]]))

      vi.mocked(useParams).mockImplementation(() => ({ address: accountResult.address }))

      return executeComponentTest(
        () => render(<AccountPage />, undefined, myStore),
        async (component) => {
          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            descriptionListAssertion({
              container: informationCard,
              items: [
                { term: accountAddressLabel, description: 'DHMCHBN4W5MBO72C3L3ZP6GGJHQ4OR6SW2EP3VDEJ5VHT4MERQLCTVW6PU' },
                { term: accountSignatureTypeLabel, description: 'Post-Quantum' },
              ],
            })
          })
        }
      )
    })
  })

  describe('when rendering an xChain logicsig account', () => {
    const evmAddress = '0x1111111111111111111111111111111111111111'
    const program = makeXChainProgram(evmAddress)
    const accountResult = {
      ...accountResultMother['mainnet-DHMCHBN4W5MBO72C3L3ZP6GGJHQ4OR6SW2EP3VDEJ5VHT4MERQLCTVW6PU']().build(),
      address: programAddress(program),
    }

    it('should be rendered with what the logicsig is and its EVM address', () => {
      const myStore = createStore()
      myStore.set(accountResultsAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(accountResult)]]))
      myStore.set(accountSignatureTypesAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp('lsig' as const)]]))
      const search = mockLogicsigSearch(program)

      vi.mocked(useParams).mockImplementation(() => ({ address: accountResult.address }))

      return executeComponentTest(
        () => render(<AccountPage />, undefined, myStore),
        async (component) => {
          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            descriptionListAssertion({
              container: informationCard,
              items: [
                { term: accountAddressLabel, description: accountResult.address },
                { term: accountSignatureTypeLabel, description: 'LogicSig' },
                { term: logicsigKnownAsLabel, description: 'xChain EVM account' },
                { term: logicsigEvmAddressLabel, description: evmAddress },
              ],
            })
            expect(getByDescriptionTerm(informationCard, logicsigTemplateIdLabel).textContent).toMatch(/^[0-9a-f]{16}$/)
          })
          expect(search.address).toHaveBeenCalledWith(accountResult.address)
          expect(search.addressRole).toHaveBeenCalledWith('sender')
          expect(search.sigType).toHaveBeenCalledWith('lsig')
        }
      )
    })
  })

  describe('when rendering a hybrid logicsig account', () => {
    const ed25519PK = new Uint8Array(32).fill(7)
    const program = makeHybridProgram({ ed25519PK, falcon1024PK: new Uint8Array(1793).fill(9) })
    const accountResult = {
      ...accountResultMother['mainnet-DHMCHBN4W5MBO72C3L3ZP6GGJHQ4OR6SW2EP3VDEJ5VHT4MERQLCTVW6PU']().build(),
      address: programAddress(program),
    }

    it('should be rendered with its Ed25519 signer', () => {
      const myStore = createStore()
      myStore.set(accountResultsAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(accountResult)]]))
      myStore.set(accountSignatureTypesAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp('lsig' as const)]]))
      mockLogicsigSearch(program)

      vi.mocked(useParams).mockImplementation(() => ({ address: accountResult.address }))

      return executeComponentTest(
        () => render(<AccountPage />, undefined, myStore),
        async (component) => {
          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            expect(getByDescriptionTerm(informationCard, logicsigKnownAsLabel).textContent).toBe('Hybrid Ed25519 + Falcon-1024 account')
            expect(getByDescriptionTerm(informationCard, logicsigEd25519AccountLabel).textContent).toBe(encodeAddress(ed25519PK))
          })
        }
      )
    })
  })

  describe('when rendering a rekeyed logicsig account', () => {
    const program = makeXChainProgram('0x2222222222222222222222222222222222222222')
    const rekeyedAccountResult = accountResultMother['mainnet-DGOANM6JL4VNSBJW737T24V4WVQINFWELRE3OKHQQFZ2JFMVKUF52D4AY4']().build()
    const accountResult = { ...rekeyedAccountResult, address: programAddress(program) }

    it('should find the program in the round the account was created', () => {
      const myStore = createStore()
      myStore.set(accountResultsAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(accountResult)]]))
      // The indexer clears the signature type of rekeyed accounts
      myStore.set(accountSignatureTypesAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(null)]]))
      vi.mocked(indexer.lookupAccountByID).mockReturnValueOnce({
        exclude: vi.fn().mockReturnValue({ do: vi.fn().mockResolvedValue({ account: { createdAtRound: 26052410n } }) }),
      } as unknown as ReturnType<typeof indexer.lookupAccountByID>)
      const search = mockLogicsigSearch(program)

      vi.mocked(useParams).mockImplementation(() => ({ address: accountResult.address }))

      return executeComponentTest(
        () => render(<AccountPage />, undefined, myStore),
        async (component) => {
          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            expect(getByDescriptionTerm(informationCard, logicsigKnownAsLabel).textContent).toBe('xChain EVM account')
          })
          expect(search.minRound).toHaveBeenCalledWith(26052410n)
          expect(search.maxRound).toHaveBeenCalledWith(26052410n)
          expect(search.sigType).not.toHaveBeenCalled()
        }
      )
    })
  })

  describe('when rendering an account that signed with a delegated logicsig', () => {
    const accountResult = accountResultMother['mainnet-DHMCHBN4W5MBO72C3L3ZP6GGJHQ4OR6SW2EP3VDEJ5VHT4MERQLCTVW6PU']().build()

    it('should not show the program, as it is not the account itself', () => {
      const myStore = createStore()
      myStore.set(accountResultsAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(accountResult)]]))
      myStore.set(accountSignatureTypesAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp('lsig' as const)]]))
      const search = mockLogicsigSearch(makeXChainProgram('0x1111111111111111111111111111111111111111'))

      vi.mocked(useParams).mockImplementation(() => ({ address: accountResult.address }))

      return executeComponentTest(
        () => render(<AccountPage />, undefined, myStore),
        async (component) => {
          await waitFor(() => expect(search.do).toHaveBeenCalled())
          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            expect(getByDescriptionTerm(informationCard, accountSignatureTypeLabel).textContent).toBe('LogicSig')
          })
          const informationCard = component.getByLabelText(accountInformationLabel)
          expect(queryByDescriptionTerm(informationCard, logicsigKnownAsLabel)).toBeNull()
          expect(queryByDescriptionTerm(informationCard, logicsigTemplateIdLabel)).toBeNull()
        }
      )
    })
  })

  describe('when rendering an account that becomes stale', () => {
    const accountResult = accountResultMother['mainnet-BIQXAK67KSCKN3EJXT4S3RVXUBFOLZ45IQOBTSOQWOSR4LLULBTD54S5IA']().build()
    const assetResults = new Map([
      [924268058n, createReadOnlyAtomAndTimestamp(assetResultMother['mainnet-924268058']().build())],
      [1010208883n, createReadOnlyAtomAndTimestamp(assetResultMother['mainnet-1010208883']().build())],
      [1096015467n, createReadOnlyAtomAndTimestamp(assetResultMother['mainnet-1096015467']().build())],
    ])

    it('should be rendered with the refresh button', () => {
      const myStore = createStore()
      myStore.set(accountResultsAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(accountResult)]]))
      myStore.set(assetResultsAtom, assetResults)

      vi.mocked(useParams).mockImplementation(() => ({ address: accountResult.address }))

      return executeComponentTest(
        () => render(<AccountPage />, undefined, myStore),
        async (component) => {
          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            descriptionListAssertion({
              container: informationCard,
              items: [{ term: accountAddressLabel, description: 'BIQXAK67KSCKN3EJXT4S3RVXUBFOLZ45IQOBTSOQWOSR4LLULBTD54S5IA' }],
            })

            const refreshButton = component.queryByLabelText(refreshButtonLabel)
            expect(refreshButton).toBeFalsy()
          })

          // Simulate the account being evicted from the store, due to staleness
          myStore.set(accountResultsAtom, new Map())

          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            descriptionListAssertion({
              container: informationCard,
              items: [{ term: accountAddressLabel, description: 'BIQXAK67KSCKN3EJXT4S3RVXUBFOLZ45IQOBTSOQWOSR4LLULBTD54S5IA' }],
            })

            const refreshButton = component.getByLabelText(refreshButtonLabel)
            expect(refreshButton).toBeTruthy()
          })
        }
      )
    })
  })

  describe('when rendering an account with a huge number of assets and falls back to excluding assets and applications', () => {
    const accountResult = accountResultMother['mainnet-X6MNR4AVJQEMJRHAPZ6F4O4SVDIYN67ZRMD2O3ULPY4QFMANQNZOEYHODE']().build()
    it('should render the account without the assets', () => {
      const myStore = createStore()
      myStore.set(accountResultsAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(accountResult)]]))

      vi.mocked(useParams).mockImplementation(() => ({ address: accountResult.address }))

      return executeComponentTest(
        () => render(<AccountPage />, undefined, myStore),
        async (component) => {
          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            descriptionListAssertion({
              container: informationCard,
              items: [
                { term: accountAddressLabel, description: 'X6MNR4AVJQEMJRHAPZ6F4O4SVDIYN67ZRMD2O3ULPY4QFMANQNZOEYHODE' },
                { term: accountBalanceLabel, description: '273,116.395038' },
                { term: accountMinBalanceLabel, description: '98,439.4' },
                { term: accountAssetsHeldLabel, description: '?' },
                { term: accountAssetsCreatedLabel, description: '984393' },
                { term: accountAssetsOptedInLabel, description: '984393' },
                { term: accountApplicationsCreatedLabel, description: '0' },
                { term: accountApplicationsOptedInLabel, description: '0' },
              ],
            })
            const activityTabList = component.getByRole('tablist', { name: accountActivityLabel })
            expect(activityTabList).toBeTruthy()
            expect(activityTabList.children.length).toBe(2)

            const assetTabList = component.getByRole('tablist', { name: accountAssetLabel })
            expect(assetTabList).toBeTruthy()
            expect(assetTabList.children.length).toBe(3)

            const applicationTabList = component.getByRole('tablist', { name: accountApplicationLabel })
            expect(applicationTabList).toBeTruthy()
            expect(applicationTabList.children.length).toBe(2)
          })
        }
      )
    })
  })

  describe('when rendering an account with an NFD', () => {
    const accountResult = accountResultMother['mainnet-DHMCHBN4W5MBO72C3L3ZP6GGJHQ4OR6SW2EP3VDEJ5VHT4MERQLCTVW6PU']().build()
    const nfdResult = nfdResultMother['mainnet-datamuseum.algo']().build()

    it('should be rendered with the correct data', async () => {
      const myStore = createStore()
      myStore.set(accountResultsAtom, new Map([[accountResult.address, createReadOnlyAtomAndTimestamp(accountResult)]]))
      myStore.set(
        reverseNfdsAtom,
        new Map([[nfdResult.depositAccount, [atom<string | Promise<string | null> | null>(nfdResult.name), Date.now()] as const]])
      )
      myStore.set(forwardNfdResultsAtom, new Map([[nfdResult.name, createReadOnlyAtomAndTimestamp(nfdResult)]]))

      vi.mocked(useParams).mockImplementation(() => ({ address: accountResult.address }))

      renderHook(async () => {
        const setCustomNetworkConfig = useSetCustomNetworkConfig()
        setCustomNetworkConfig(localnetId, {
          nfdApiUrl: 'http://not-used',
          ...defaultNetworkConfigs[localnetId],
        })
      })

      return executeComponentTest(
        () => render(<AccountPage />, undefined, myStore),
        async (component) => {
          await waitFor(() => {
            const informationCard = component.getByLabelText(accountInformationLabel)
            descriptionListAssertion({
              container: informationCard,
              items: [
                { term: accountAddressLabel, description: 'DHMCHBN4W5MBO72C3L3ZP6GGJHQ4OR6SW2EP3VDEJ5VHT4MERQLCTVW6PU' },
                { term: accountNfdLabel, description: 'datamuseum.algo' },
                { term: accountBalanceLabel, description: '1,915.70635' },
                { term: accountMinBalanceLabel, description: '0.1' },
                { term: accountAssetsHeldLabel, description: '0' },
                { term: accountAssetsCreatedLabel, description: '0' },
                { term: accountAssetsOptedInLabel, description: '0' },
                { term: accountApplicationsCreatedLabel, description: '0' },
                { term: accountApplicationsOptedInLabel, description: '0' },
              ],
            })
          })
        }
      )
    })
  })
})
