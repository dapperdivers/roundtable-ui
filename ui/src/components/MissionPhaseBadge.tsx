import { PhaseBadge } from './ui'

/** Mission phase pill. Thin alias over the shared PhaseBadge so existing
 *  imports keep working; colors come from lib/status. */
export function MissionPhaseBadge({ phase }: { phase: string }) {
  return <PhaseBadge phase={phase} />
}
