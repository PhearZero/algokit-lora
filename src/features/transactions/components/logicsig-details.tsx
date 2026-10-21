import { cn } from '@/features/common/utils'
import { Logicsig } from '../models'
import { ApplicationProgram } from '@/features/applications/components/application-program'
import { useMemo } from 'react'
import { Card, CardContent } from '@/features/common/components/card'
import { DescriptionList } from '@/features/common/components/description-list'
import { asKnownLogicsig } from '@/features/programs/mappers'
import { asKnownLogicsigItems } from '@/features/programs/components/known-logicsig-items'

type LogicsigProps = {
  signature: Logicsig
}

export const logicsigLabel = 'View Logic Signature Details'

export function LogicsigDetails({ signature }: LogicsigProps) {
  const logicsigItems = useMemo(() => asKnownLogicsigItems(asKnownLogicsig(signature.logic)), [signature.logic])

  return (
    <div className={cn('space-y-2')}>
      <h3>LogicSig</h3>
      <Card>
        <CardContent className={cn('space-y-1')}>
          <DescriptionList items={logicsigItems} />
        </CardContent>
      </Card>
      <ApplicationProgram tabsListAriaLabel={logicsigLabel} base64Program={signature.logic} />
    </div>
  )
}
