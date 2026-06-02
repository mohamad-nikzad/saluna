import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SakuraMark } from '@repo/ui/sakura-mark'

import { HeroPillCTA, HeroShell } from './-shell'

// Welcome is not a tracked step and has no prerequisites — it is the entry
// screen, always reachable while onboarding is active. No form, no mutation.
export const Route = createFileRoute('/_authed/onboarding/welcome')({
  component: WelcomeScreen,
})

function WelcomeScreen() {
  const navigate = useNavigate()

  return (
    <HeroShell
      footer={
        <HeroPillCTA onClick={() => navigate({ to: '/onboarding/hours' })}>
          بزن بریم
        </HeroPillCTA>
      }
    >
      <SakuraMark size={88} color="rgba(255,255,255,0.9)" />
      <h1 className="mt-7 text-3xl font-extrabold tracking-tight">سلام 👋</h1>
      <p className="mt-3 text-xl font-bold leading-relaxed opacity-95">
        بیایید با هم سالن‌تان را
        <br />
        راه بیندازیم
      </p>
      <p className="mt-4 text-sm leading-loose opacity-80">
        چند سؤال ساده می‌پرسم و بقیه‌اش را
        <br />
        خودم آماده می‌کنم. آماده‌اید؟
      </p>
    </HeroShell>
  )
}
