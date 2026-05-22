import type { Metadata } from 'next'
import Image from 'next/image'
import { Lalezar, Vazirmatn } from 'next/font/google'
import {
  BellRing,
  CalendarDays,
  ChartNoAxesCombined,
  Scissors,
  Sparkles,
  UserPlus,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { webEnv } from '@/env'

const displayFont = Lalezar({
  subsets: ['arabic', 'latin'],
  weight: '400',
})

const bodyFont = Vazirmatn({
  subsets: ['arabic', 'latin'],
  variable: '--font-landing-body',
})

export const metadata: Metadata = {
  title: 'سالورا | مدیریت هوشمند سالن زیبایی',
  description:
    'سالورا نرم‌افزار مدیریت نوبت‌ها، مشتریان، خدمات و پرسنل برای سالن‌های زیبایی است.',
}

type Feature = {
  title: string
  text: string
  icon: LucideIcon
}

const features: Feature[] = [
  {
    title: 'تقویم نوبت‌ها',
    text: 'برنامه روزانه سالن بر اساس پرسنل و ساعت کاری در یک نگاه.',
    icon: CalendarDays,
  },
  {
    title: 'مدیریت مشتریان',
    text: 'پروفایل، شماره تماس و سابقه مراجعه هر مشتری یک‌جا نگه‌داری می‌شود.',
    icon: UsersRound,
  },
  {
    title: 'مدیریت پرسنل',
    text: 'تخصص، ساعت کاری و نوبت‌های هر همکار به‌صورت جداگانه مدیریت می‌شود.',
    icon: UserPlus,
  },
  {
    title: 'خدمات و دسته‌بندی',
    text: 'برای هر خدمت زمان، قیمت و مجری مشخص کنید تا ثبت نوبت سریع شود.',
    icon: Scissors,
  },
  {
    title: 'گزارش روزانه',
    text: 'درآمد، نوبت‌های انجام‌شده و عملکرد پرسنل را روزانه مشاهده کنید.',
    icon: ChartNoAxesCombined,
  },
  {
    title: 'بازگشت مشتری',
    text: 'مشتریان غیرفعال را شناسایی کنید و آن‌ها را به سالن بازگردانید.',
    icon: BellRing,
  },
]

const stats = [
  { value: '۳ دقیقه', label: 'ثبت یک نوبت کامل' },
  { value: '۱۰۰٪', label: 'فارسی و راست‌چین' },
  { value: '۲۴/۷', label: 'دسترسی از موبایل و دسکتاپ' },
]

const testimonials = [
  {
    name: 'نازنین رحیمی',
    role: 'مدیر سالن نارسیس',
    quote:
      'از وقتی سالورا را راه‌اندازی کردیم، تماس‌های تکراری برای هماهنگی نوبت کم شده و تیم با خیال راحت‌تر کار می‌کند.',
  },
  {
    name: 'سارا یوسفی',
    role: 'متخصص رنگ و لایت',
    quote:
      'برنامه روزانه‌ام را روی موبایل می‌بینم و دیگر نگران تداخل نوبت‌ها نیستم. گزارش‌های ماهانه هم خیلی کمکم کرده.',
  },
  {
    name: 'مهسا کریمی',
    role: 'پذیرش سالن',
    quote:
      'ثبت مشتری جدید فقط چند ثانیه طول می‌کشد و همه اطلاعات لازم در یک صفحه دیده می‌شود.',
  },
]

const dashboardMetrics = [
  { label: 'مشتریان جدید', value: '۲۴', delta: '+۱۵٪', tone: 'rose' as const },
  { label: 'درآمد امروز', value: '۱۸٬۷۵۰٬۰۰۰', delta: '+۸٪', tone: 'amber' as const },
  { label: 'رزروهای امروز', value: '۲۸', delta: '+۱۲٪', tone: 'violet' as const },
  { label: 'خدمات انجام‌شده', value: '۳۴', delta: '+۱۰٪', tone: 'pink' as const },
]

const upcomingAppointments = [
  { time: '۱۰:۰۰', name: 'رنگ و مش', staff: 'نگین محمدی' },
  { time: '۱۱:۳۰', name: 'کراتینه مو', staff: 'سارا یوسفی' },
  { time: '۱۳:۱۵', name: 'کوتاهی مو', staff: 'مینا احمدی' },
  { time: '۱۵:۰۰', name: 'میکاپ', staff: 'الهام کریمی' },
]

const popularServices = [
  { name: 'رنگ و مش', value: 48 },
  { name: 'کراتینه مو', value: 25 },
  { name: 'کوتاهی مو', value: 15 },
  { name: 'میکاپ', value: 12 },
]

const loginHref = new URL('/login', webEnv.NEXT_PUBLIC_APP_URL).toString()
const signupHref = new URL('/signup', webEnv.NEXT_PUBLIC_APP_URL).toString()

const toneClass: Record<'rose' | 'amber' | 'violet' | 'pink', string> = {
  rose: 'bg-rose-100 text-rose-600',
  amber: 'bg-amber-100 text-amber-600',
  violet: 'bg-violet-100 text-violet-600',
  pink: 'bg-pink-100 text-pink-600',
}

export default function LandingPage() {
  return (
    <main
      dir="rtl"
      className={`${bodyFont.className} saloora-landing relative box-border min-h-dvh overflow-hidden bg-[#fdf5f8] text-[#3f2730]`}
    >
      <style>{`
        .saloora-landing { max-width: 100%; overflow-x: hidden; }
        @keyframes saloora-petal {
          0% { transform: translate3d(0, -20px, 0) rotate(0deg); opacity: 0; }
          15% { opacity: 0.85; }
          100% { transform: translate3d(-60px, 540px, 0) rotate(-220deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: no-preference) {
          .saloora-petal { animation: saloora-petal 14s linear infinite; }
        }
      `}</style>

      {/* HERO */}
      <section
        id="top"
        className="relative isolate overflow-hidden"
      >
        <Image
          src="/landing/hero-bg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 hidden object-cover sm:block"
        />
        <Image
          src="/landing/hero-bg-mobile.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover sm:hidden"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(253,245,248,0)_0%,rgba(253,245,248,0.45)_70%,#fdf5f8_100%)]" />

        <span className="saloora-petal absolute right-[12%] top-20 h-4 w-2.5 rotate-45 rounded-[8px] bg-rose-300/70" />
        <span className="saloora-petal absolute right-[42%] top-10 h-3 w-2 rotate-12 rounded-[8px] bg-rose-200/80 [animation-delay:3s]" />
        <span className="saloora-petal absolute right-[68%] top-28 h-4 w-2.5 -rotate-12 rounded-[8px] bg-pink-300/70 [animation-delay:6s]" />
        <span className="saloora-petal absolute right-[85%] top-16 h-3 w-2 rotate-45 rounded-[8px] bg-white/80 [animation-delay:9s]" />

        <header className="relative mx-auto flex w-full max-w-7xl box-border items-center justify-between px-5 py-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5" aria-label="سالورا">
            <Image
              src="/landing/saloora-mark.png"
              alt=""
              width={44}
              height={44}
              className="h-10 w-10 sm:h-11 sm:w-11"
              priority
            />
            <span className={`${displayFont.className} text-2xl leading-none text-[#7a2a40] sm:text-3xl`}>
              سالورا
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-[#6b4955] md:flex">
            <a href="#features" className="transition hover:text-[#7a2a40]">
              امکانات
            </a>
            <a href="#preview" className="transition hover:text-[#7a2a40]">
              داشبورد
            </a>
            <a href="#testimonials" className="transition hover:text-[#7a2a40]">
              نظرات
            </a>
          </nav>

          <a
            href={loginHref}
            className="rounded-md border border-[#d68aa0] bg-white/70 px-4 py-2 text-sm font-bold text-[#7a2a40] backdrop-blur transition hover:bg-[#7a2a40] hover:text-white"
          >
            ورود
          </a>
        </header>

        <div className="relative mx-auto flex w-full max-w-4xl box-border flex-col items-center px-5 pb-24 pt-12 text-center sm:px-8 sm:pb-32 sm:pt-20">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e9b4c2] bg-white/70 px-4 py-1.5 text-xs font-bold text-[#7a2a40] backdrop-blur sm:text-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            مدیریت هوشمند سالن زیبایی
          </p>

          <h1
            className={`${displayFont.className} text-4xl leading-[1.25] text-[#4a1e2e] sm:text-6xl lg:text-7xl lg:leading-[1.15]`}
          >
            ساده، حرفه‌ای،
            <br />
            <span className="text-[#9b2f4a]">سالورا</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-[#6b4955] sm:mt-8 sm:text-lg">
            با سالورا تقویم نوبت‌ها، مشتریان، پرسنل و خدمات سالن را در یک مسیر مرتب
            نگه می‌دارید و روز کاری را با تمرکز بیشتری جلو می‌برید.
          </p>

          <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a
              href={signupHref}
              className="rounded-md bg-[#c3425b] px-7 py-3 text-center text-base font-bold text-white shadow-[0_18px_40px_rgba(124,28,48,0.28)] transition hover:bg-[#a82b46]"
            >
              شروع رایگان
            </a>
            <a
              href="#features"
              className="rounded-md border border-[#d68aa0] bg-white/70 px-7 py-3 text-center text-base font-bold text-[#7a2a40] backdrop-blur transition hover:bg-white"
            >
              مشاهده امکانات
            </a>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-extrabold text-[#9b3348]">امکانات سالورا</p>
            <h2
              className={`${displayFont.className} mt-3 text-3xl leading-tight text-[#3f2730] sm:text-5xl`}
            >
              همه چیزهایی که سالن نیاز دارد
            </h2>
            <p className="mt-4 text-base leading-8 text-[#6b4955]">
              از ثبت نوبت تا پیگیری مشتری، همه ابزارهای روزانه سالن در یک پنل.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon

              return (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-[#f3d5dd] bg-white/80 p-6 shadow-[0_18px_50px_rgba(155,51,72,0.06)] backdrop-blur transition hover:-translate-y-1 hover:border-[#e8a8ba] hover:shadow-[0_24px_60px_rgba(155,51,72,0.12)]"
                >
                  <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[#fde2e9] to-[#f5b6c6] text-[#9b2f4a] transition group-hover:from-[#9b2f4a] group-hover:to-[#c3425b] group-hover:text-white">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-extrabold text-[#3f2730]">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#6b4955]">{feature.text}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section
        id="preview"
        className="relative isolate overflow-hidden px-5 py-20 sm:px-8 sm:py-24"
      >
        <Image
          src="/landing/section-bg.webp"
          alt=""
          fill
          sizes="100vw"
          className="absolute inset-0 -z-10 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#fdf5f8]/30 via-[#fdf5f8]/10 to-[#fdf5f8]/40" />

        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-extrabold text-[#9b3348]">داشبورد سالورا</p>
            <h2
              className={`${displayFont.className} mt-3 text-3xl leading-tight text-[#3f2730] sm:text-5xl`}
            >
              همه آنچه نیاز دارید در یک نگاه
            </h2>
            <p className="mt-4 text-base leading-8 text-[#6b4955]">
              برنامه روز، آمار درآمد، مشتریان و عملکرد پرسنل به‌صورت زنده.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-3xl border border-white/60 bg-white/85 p-4 shadow-[0_30px_80px_rgba(155,51,72,0.14)] backdrop-blur-md sm:p-6 lg:p-8">
            {/* metric cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {dashboardMetrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-[#f3d5dd] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className={`grid h-9 w-9 place-items-center rounded-lg ${toneClass[m.tone]}`}>
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-bold text-emerald-600">{m.delta}</span>
                  </div>
                  <p className="mt-4 text-xs text-[#8b6b73]">{m.label}</p>
                  <p className={`${displayFont.className} mt-1 text-2xl text-[#3f2730]`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* preview grid */}
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              {/* schedule timeline */}
              <div className="rounded-xl border border-[#f3d5dd] bg-white p-5">
                <div className="flex items-center justify-between border-b border-[#f3d5dd] pb-3">
                  <p className="text-sm font-extrabold text-[#3f2730]">رزروهای امروز</p>
                  <span className="rounded-md bg-[#fce5ec] px-2 py-0.5 text-xs font-bold text-[#9b2f4a]">
                    امروز
                  </span>
                </div>
                <ul className="mt-4 space-y-3">
                  {upcomingAppointments.map((a) => (
                    <li
                      key={a.time}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-[#f8e0e7] bg-[#fdf5f8] p-3"
                    >
                      <span
                        className={`${displayFont.className} text-base text-[#9b2f4a]`}
                        dir="ltr"
                      >
                        {a.time}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#3f2730]">{a.name}</p>
                        <p className="mt-0.5 truncate text-xs text-[#8b6b73]">{a.staff}</p>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              </div>

              {/* popular services */}
              <div className="rounded-xl border border-[#f3d5dd] bg-white p-5">
                <div className="flex items-center justify-between border-b border-[#f3d5dd] pb-3">
                  <p className="text-sm font-extrabold text-[#3f2730]">سرویس‌های پرطرفدار</p>
                  <span className="text-xs text-[#8b6b73]">این هفته</span>
                </div>
                <ul className="mt-4 space-y-4">
                  {popularServices.map((s) => (
                    <li key={s.name}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-bold text-[#3f2730]">{s.name}</span>
                        <span className="font-bold text-[#9b2f4a]" dir="ltr">
                          {s.value}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#fce5ec]">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-[#c3425b] to-[#e8a8ba]"
                          style={{ width: `${s.value}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* stats */}
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-[#f3d5dd] bg-white/80 p-6 text-center backdrop-blur"
              >
                <p className={`${displayFont.className} text-3xl text-[#9b2f4a]`}>{s.value}</p>
                <p className="mt-2 text-sm text-[#6b4955]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="relative px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-extrabold text-[#9b3348]">نظرات کاربران</p>
            <h2
              className={`${displayFont.className} mt-3 text-3xl leading-tight text-[#3f2730] sm:text-5xl`}
            >
              آنچه مشتریان ما می‌گویند
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col gap-5 rounded-2xl border border-[#f3d5dd] bg-white/85 p-6 shadow-[0_18px_50px_rgba(155,51,72,0.07)] backdrop-blur"
              >
                <div className="flex gap-1 text-[#c3425b]" aria-hidden="true">
                  {'★★★★★'.split('').map((s, i) => (
                    <span key={i}>{s}</span>
                  ))}
                </div>
                <blockquote className="text-sm leading-7 text-[#3f2730]">«{t.quote}»</blockquote>
                <figcaption className="flex items-center gap-3 border-t border-[#f3d5dd] pt-4">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#fde2e9] to-[#e8a8ba] text-base font-extrabold text-[#7a2a40]">
                    {t.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[#3f2730]">{t.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[#8b6b73]">{t.role}</p>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="start" className="relative px-5 pb-24 sm:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl">
          <Image
            src="/landing/cta-bg.webp"
            alt=""
            fill
            sizes="100vw"
            className="absolute inset-0 -z-10 object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,235,242,0.45)_100%)]" />

          <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:px-10 sm:py-20">
            <h2
              className={`${displayFont.className} text-3xl leading-tight text-[#4a1e2e] sm:text-5xl`}
            >
              آماده‌ای سالن خود را آنلاین کنی؟
            </h2>
            <p className="mt-5 text-base leading-8 text-[#6b4955] sm:text-lg">
              همین حالا حساب مدیر بساز و اولین نوبت سالن را در سالورا ثبت کن.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={signupHref}
                className="w-full rounded-md bg-[#c3425b] px-8 py-3 text-center text-base font-bold text-white shadow-[0_18px_40px_rgba(124,28,48,0.32)] transition hover:bg-[#a82b46] sm:w-auto"
              >
                ساخت حساب رایگان
              </a>
              <a
                href={loginHref}
                className="w-full rounded-md border border-[#d68aa0] bg-white/80 px-8 py-3 text-center text-base font-bold text-[#7a2a40] backdrop-blur transition hover:bg-white sm:w-auto"
              >
                ورود به حساب
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#f3d5dd] bg-white/60 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Image
              src="/landing/saloora-mark.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className={`${displayFont.className} text-xl text-[#7a2a40]`}>سالورا</span>
          </div>
          <p className="text-xs text-[#8b6b73]">© ۱۴۰۴ سالورا. تمام حقوق محفوظ است.</p>
          <div className="flex items-center gap-1.5 text-xs text-[#8b6b73]">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            <span>ساخته‌شده برای سالن‌های ایرانی</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
