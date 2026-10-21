import { cn } from '@/features/common/utils'
import { TransactionLink } from './transaction-link'
import { Card, CardContent } from '@/features/common/components/card'
import { ellipseId } from '@/utils/ellipse-id'
import { DescriptionList } from '@/features/common/components/description-list'
import { ArrowRightLeft, Info } from 'lucide-react'
import { TransactionSummary, TransactionType } from '@/features/transactions/models'
import { useLoadableReverseLookupNfdResult } from '@/features/nfd/data'
import { ellipseAddress } from '@/utils/ellipse-address'
import { RenderLoadable } from '@/features/common/components/render-loadable'
import { TransactionTypeBadge } from './transaction-type-badge'
import { useKnownAddressName } from '@/features/programs/data/known-address-names'
import { useKnownApplicationName } from '@/features/programs/data/known-application-names'

export const latestTransactionsTitle = 'Latest Transactions'

type Props = {
  latestTransactions: TransactionSummary[]
}

// Known application accounts and logic signature accounts are named the same way as NFDs, unless they have an NFD.
function TransactionAddress({ address }: { address: string }) {
  const loadableNfd = useLoadableReverseLookupNfdResult(address)
  const knownName = useKnownAddressName(address)
  const fallback = knownName ? <span title={address}>{knownName}</span> : ellipseAddress(address)
  return (
    <RenderLoadable loadable={loadableNfd} fallback={fallback}>
      {(nfd) => (nfd ? nfd.name : fallback)}
    </RenderLoadable>
  )
}

// Known applications are named in place of their ID, with the ID on hover.
function TransactionApplication({ applicationId }: { applicationId: bigint }) {
  const knownName = useKnownApplicationName(applicationId)
  const id = applicationId.toString()
  return knownName ? <span title={id}>{knownName}</span> : id
}

export function LatestTransactions({ latestTransactions }: Props) {
  return (
    <Card>
      <CardContent className={cn('space-y-1')}>
        <h2>{latestTransactionsTitle}</h2>
        {latestTransactions.length > 0 && (
          <ul>
            {latestTransactions.map((transaction) => (
              <li key={transaction.id} className="border-b last:border-0">
                <TransactionLink
                  transactionId={transaction.id}
                  className="animate-in fade-in-20 hover:bg-accent flex w-full gap-2 p-[0.666rem] text-sm"
                >
                  <ArrowRightLeft className="text-primary hidden sm:max-lg:block xl:block" />
                  <div className="w-full">
                    <header className="flex justify-between">
                      <h3 className={cn('leading-none mb-2 tracking-wide')}>{ellipseId(transaction.id)}</h3>
                      <TransactionTypeBadge transactionType={transaction.type} />
                    </header>

                    <DescriptionList
                      items={[
                        { dt: 'From:', dd: <TransactionAddress address={transaction.from} /> },
                        {
                          dt: 'To:',
                          dd:
                            transaction.to && typeof transaction.to === 'string' ? (
                              <TransactionAddress address={transaction.to} />
                            ) : transaction.to && transaction.type === TransactionType.AppCall ? (
                              <TransactionApplication applicationId={BigInt(transaction.to)} />
                            ) : (
                              transaction.to
                            ),
                        },
                      ]}
                    />
                  </div>
                </TransactionLink>
              </li>
            ))}
          </ul>
        )}
        {latestTransactions.length === 0 && (
          <div className="mx-2 flex items-center gap-2 py-3 align-middle">
            <Info />
            <span>No recent data available.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
