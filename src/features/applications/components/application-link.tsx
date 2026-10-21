import { cn } from '@/features/common/utils'
import { TemplatedNavLink } from '@/features/routing/components/templated-nav-link/templated-nav-link'
import { Urls } from '@/routes/urls'
import { PropsWithChildren } from 'react'
import { ApplicationId } from '../data/types'
import { useSelectedNetwork } from '@/features/network/data'
import { CopyButton } from '@/features/common/components/copy-button'
import { useKnownApplicationName } from '@/features/programs/data/known-application-names'

type Props = PropsWithChildren<{
  applicationId: ApplicationId
  className?: string
  showCopyButton?: boolean
}>

export function ApplicationLink({ applicationId, className, showCopyButton, children }: Props) {
  const [selectedNetwork] = useSelectedNetwork()

  const link = (
    <TemplatedNavLink
      className={cn(!children && 'text-primary underline truncate', className)}
      urlTemplate={Urls.Network.Explore.Application.ById}
      urlParams={{ applicationId: applicationId.toString(), networkId: selectedNetwork }}
    >
      {children}
    </TemplatedNavLink>
  )

  return children ? link : <NamedApplicationLink applicationId={applicationId} className={className} showCopyButton={showCopyButton} />
}

// Known applications are named the same way as known accounts: the name in place of the ID, with the ID on hover.
// Where the ID can be copied, it is shown too, followed by the name.
function NamedApplicationLink({ applicationId, className, showCopyButton }: Omit<Props, 'children'>) {
  const [selectedNetwork] = useSelectedNetwork()
  const knownName = useKnownApplicationName(applicationId)
  const id = applicationId.toString()

  return (
    <div className="flex items-center">
      <TemplatedNavLink
        className={cn('text-primary underline truncate', className)}
        urlTemplate={Urls.Network.Explore.Application.ById}
        urlParams={{ applicationId: id, networkId: selectedNetwork }}
        title={knownName ? id : undefined}
      >
        {knownName && !showCopyButton ? knownName : id}
      </TemplatedNavLink>
      {knownName && showCopyButton && <span className="ml-2 truncate text-muted-foreground">{knownName}</span>}
      {showCopyButton && <CopyButton value={id} />}
    </div>
  )
}
