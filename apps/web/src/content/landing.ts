import { PUBLIC_APP_URL } from '@/env'
import type { IconName } from '@/components/landing/icons'

export const displayClass = 'font-[family-name:var(--font-lalezar)]'

export type MetricTone = 'rose' | 'amber' | 'violet' | 'pink'

export const toneClass: Record<MetricTone, string> = {
  rose: 'bg-rose-100 text-rose-600',
  amber: 'bg-amber-100 text-amber-600',
  violet: 'bg-violet-100 text-violet-600',
  pink: 'bg-pink-100 text-pink-600',
}

export type Feature = {
  title: string
  text: string
  icon: IconName
}

export const features: Feature[] = [
  {
    title: 'تقویم نوبت‌ها',
    text: 'برنامه روزانه سالن بر اساس پرسنل و ساعت کاری در یک نگاه.',
    icon: 'calendar-days',
  },
  {
    title: 'مدیریت مشتریان',
    text: 'پروفایل، شماره تماس و سابقه مراجعه هر مشتری یک‌جا نگه‌داری می‌شود.',
    icon: 'users-round',
  },
  {
    title: 'مدیریت پرسنل',
    text: 'تخصص، ساعت کاری و نوبت‌های هر همکار به‌صورت جداگانه مدیریت می‌شود.',
    icon: 'user-plus',
  },
  {
    title: 'خدمات و دسته‌بندی',
    text: 'برای هر خدمت زمان، قیمت و مجری مشخص کنید تا ثبت نوبت سریع شود.',
    icon: 'scissors',
  },
  {
    title: 'گزارش روزانه',
    text: 'درآمد، نوبت‌های انجام‌شده و عملکرد پرسنل را روزانه مشاهده کنید.',
    icon: 'chart-no-axes-combined',
  },
  {
    title: 'بازگشت مشتری',
    text: 'مشتریان غیرفعال را شناسایی کنید و آن‌ها را به سالن بازگردانید.',
    icon: 'bell-ring',
  },
]

export const stats = [
  { value: '۳ دقیقه', label: 'ثبت یک نوبت کامل' },
  { value: '۱۰۰٪', label: 'فارسی و راست‌چین' },
  { value: '۲۴/۷', label: 'دسترسی از موبایل و دسکتاپ' },
]

export const testimonials = [
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

export const dashboardMetrics: {
  label: string
  value: string
  delta: string
  tone: MetricTone
}[] = [
  { label: 'مشتریان جدید', value: '۲۴', delta: '+۱۵٪', tone: 'rose' },
  { label: 'درآمد امروز', value: '۱۸٬۷۵۰٬۰۰۰', delta: '+۸٪', tone: 'amber' },
  { label: 'رزروهای امروز', value: '۲۸', delta: '+۱۲٪', tone: 'violet' },
  { label: 'خدمات انجام‌شده', value: '۳۴', delta: '+۱۰٪', tone: 'pink' },
]

export const upcomingAppointments = [
  { time: '۱۰:۰۰', name: 'رنگ و مش', staff: 'نگین محمدی' },
  { time: '۱۱:۳۰', name: 'کراتینه مو', staff: 'سارا یوسفی' },
  { time: '۱۳:۱۵', name: 'کوتاهی مو', staff: 'مینا احمدی' },
  { time: '۱۵:۰۰', name: 'میکاپ', staff: 'الهام کریمی' },
]

export const popularServices = [
  { name: 'رنگ و مش', value: 48 },
  { name: 'کراتینه مو', value: 25 },
  { name: 'کوتاهی مو', value: 15 },
  { name: 'میکاپ', value: 12 },
]

export const loginHref = new URL('/login', PUBLIC_APP_URL).toString()
export const signupHref = new URL('/signup', PUBLIC_APP_URL).toString()
