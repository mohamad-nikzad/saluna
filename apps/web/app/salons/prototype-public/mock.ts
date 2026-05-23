// PROTOTYPE — throwaway mock data for /salons/prototype-public

export type MockService = {
  id: string
  name: string
  category: string
  duration: number // minutes
  price: number // toman
  description?: string
  image?: string
}

export type MockSalon = {
  name: string
  slug: string
  phone: string
  bio: string
  accent: string
  bannerUrl?: string
  logoUrl?: string
  rating: number
  reviewsCount: number
  address: string
  hours: string
}

export const mockSalon: MockSalon = {
  name: 'سالن زیبایی آراویرا',
  slug: 'aravira',
  phone: '09121234567',
  bio: 'سالنی مدرن و خصوصی در قلب تهران با بیش از ۱۰ سال تجربه در زمینه آرایش و زیبایی.',
  accent: '#c3425b',
  rating: 4.8,
  reviewsCount: 327,
  address: 'تهران، خیابان ولیعصر، پلاک ۲۲۸',
  hours: 'شنبه تا چهارشنبه ۹ تا ۲۱',
}

export const mockServices: MockService[] = [
  // مو
  { id: 's-hair-cut', name: 'کوتاهی مو', category: 'مو', duration: 45, price: 280_000, description: 'کوتاهی تخصصی همراه با مشاوره و شست‌وشو.', image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400' },
  { id: 's-hair-color', name: 'رنگ مو', category: 'مو', duration: 120, price: 1_200_000, description: 'رنگ‌آمیزی حرفه‌ای با محصولات وارداتی.', image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400' },
  { id: 's-hair-blowdry', name: 'سشوار و حالت', category: 'مو', duration: 30, price: 220_000, image: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400' },
  { id: 's-hair-highlight', name: 'هایلایت', category: 'مو', duration: 150, price: 1_800_000, image: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=400' },
  { id: 's-hair-balayage', name: 'بالیاژ', category: 'مو', duration: 180, price: 2_400_000, image: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=400' },
  { id: 's-hair-keratin', name: 'کراتینه مو', category: 'مو', duration: 150, price: 2_200_000, image: 'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=400' },
  { id: 's-hair-extension', name: 'اکستنشن مو', category: 'مو', duration: 240, price: 4_500_000, image: 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=400' },
  { id: 's-hair-bride', name: 'شینیون عروس', category: 'مو', duration: 120, price: 2_800_000, image: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=400' },
  // ناخن
  { id: 's-nail-mani', name: 'مانیکور', category: 'ناخن', duration: 60, price: 350_000, description: 'سوهان‌کشی، پاکسازی پوست اطراف و لاک ساده.', image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400' },
  { id: 's-nail-pedi', name: 'پدیکور', category: 'ناخن', duration: 75, price: 420_000, image: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=400' },
  { id: 's-nail-gel', name: 'کاشت ژل ناخن', category: 'ناخن', duration: 120, price: 950_000, image: 'https://images.unsplash.com/photo-1604902396830-aca29e19b067?w=400' },
  { id: 's-nail-design', name: 'دیزاین ناخن', category: 'ناخن', duration: 45, price: 280_000, image: 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=400' },
  { id: 's-nail-repair', name: 'ترمیم ناخن', category: 'ناخن', duration: 60, price: 350_000 },
  // پوست
  { id: 's-face-clean', name: 'پاکسازی صورت', category: 'پوست', duration: 60, price: 480_000, description: 'پاکسازی عمیق به همراه ماسک و ماساژ.', image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400' },
  { id: 's-face-makeup', name: 'میکاپ مجلسی', category: 'پوست', duration: 90, price: 1_500_000, image: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400' },
  { id: 's-face-bride', name: 'میکاپ عروس', category: 'پوست', duration: 150, price: 3_500_000, image: 'https://images.unsplash.com/photo-1503104834685-7205e8607eb9?w=400' },
  { id: 's-brow', name: 'اصلاح ابرو', category: 'پوست', duration: 20, price: 90_000, image: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=400' },
  { id: 's-face-microblading', name: 'میکروبلیدینگ ابرو', category: 'پوست', duration: 120, price: 2_500_000, image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400' },
  { id: 's-face-lift', name: 'لیفت و لمینت مژه', category: 'پوست', duration: 75, price: 650_000, image: 'https://images.unsplash.com/photo-1571878917532-3d11a3a86fd0?w=400' },
  { id: 's-face-laser', name: 'لیزر صورت', category: 'پوست', duration: 30, price: 380_000 },
  // بدن
  { id: 's-body-wax', name: 'اپیلاسیون کامل بدن', category: 'بدن', duration: 90, price: 850_000, image: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=400' },
  { id: 's-body-massage', name: 'ماساژ ریلکسی', category: 'بدن', duration: 60, price: 720_000, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400' },
  { id: 's-body-laser', name: 'لیزر کامل بدن', category: 'بدن', duration: 60, price: 1_400_000 },
  { id: 's-body-tan', name: 'برنزه‌سازی', category: 'بدن', duration: 45, price: 580_000 },
]

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
export function toPersian(n: number | string): string {
  return String(n).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]!)
}

export function formatPrice(toman: number): string {
  return `${toPersian(toman.toLocaleString('en-US'))} تومان`
}

export function formatDuration(min: number): string {
  if (min < 60) return `${toPersian(min)} دقیقه`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0
    ? `${toPersian(h)} ساعت`
    : `${toPersian(h)} ساعت و ${toPersian(m)} دقیقه`
}

const PERSIAN_WEEKDAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه']
const PERSIAN_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

export type MockDate = {
  key: string
  weekday: string
  weekdayShort: string
  day: string
  month: string
}

export function mockDates(count = 30): MockDate[] {
  const out: MockDate[] = []
  // Stable, fake Jalali dates starting 15 ordibehesht 1405. 6 months × 31 days.
  let day = 15
  let monthIdx = 1
  for (let i = 0; i < count; i++) {
    if (day > 31) {
      day = 1
      monthIdx = (monthIdx + 1) % JALALI_MONTHS.length
    }
    const dow = i % 7
    out.push({
      key: `date-${i}`,
      weekday: PERSIAN_WEEKDAYS[dow]!,
      weekdayShort: PERSIAN_WEEKDAYS_SHORT[dow]!,
      day: toPersian(day),
      month: JALALI_MONTHS[monthIdx]!,
    })
    day++
  }
  return out
}

export function filterServices(query: string, list: MockService[] = mockServices): MockService[] {
  const q = query.trim().toLowerCase()
  if (!q) return list
  return list.filter(
    (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
  )
}

export function mockSlots(seed: string): string[] {
  // Deterministic fake list of times
  const hash = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0)
  const base = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '14:00', '14:30', '15:00', '16:30', '17:00', '18:00', '19:00']
  return base.filter((_, i) => (hash + i) % 3 !== 0)
}
