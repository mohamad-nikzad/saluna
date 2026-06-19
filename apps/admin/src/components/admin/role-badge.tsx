import { Badge } from '#/components/ui/badge'
import { formatRole } from '#/lib/admin-format'

export { formatRole }

export function RoleBadge({
  role,
  active,
}: {
  role: string
  active?: boolean
}) {
  if (!role) {
    return <Badge variant="outline">بدون نقش پلتفرم</Badge>
  }
  if (active === undefined) {
    return <Badge>{formatRole(role)}</Badge>
  }
  return (
    <Badge variant={active ? 'default' : 'outline'}>{formatRole(role)}</Badge>
  )
}
