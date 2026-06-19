import { brand } from '@repo/brand'

export type SocialLink = {
  label: string
  href: string
}

export type PublicSiteInfo = {
  brandName: string
  operatorName: string
  location: string
  availability: string
  domain: string
  contact: {
    phone: string
    email: string
    telegram: string
  }
  socialLinks: SocialLink[]
}

export const publicSiteInfo: PublicSiteInfo = {
  brandName: brand.name.fa,
  operatorName: 'تیم سالونا',
  location: 'Tehran, Iran',
  availability: 'دسترسی آزمایشی عمومی',
  domain: brand.domains.public,
  contact: {
    phone: '09940435066',
    email: '',
    telegram: '',
  },
  socialLinks: [],
}

export const publicNavLinks = [
  { href: '/', label: 'خانه' },
  { href: '/services', label: 'خدمات' },
  { href: '/about', label: 'درباره ما' },
  { href: '/contact', label: 'تماس با ما' },
  { href: '/privacy', label: 'حریم خصوصی' },
  { href: '/terms', label: 'قوانین' },
] as const

export const publicServiceItems = [
  {
    title: 'مدیریت نوبت‌ها',
    text: 'ثبت، ویرایش و پیگیری نوبت‌های تاییدشده سالن در تقویم روزانه و هفتگی.',
  },
  {
    title: 'پرونده مشتریان',
    text: 'نگهداری نام، شماره تماس، یادداشت‌ها، برچسب‌ها و سابقه مراجعه مشتریان.',
  },
  {
    title: 'مدیریت خدمات سالن',
    text: 'تعریف دسته، گروه، خدمت، قیمت، مدت زمان، خدمات اضافه و خدمات ترکیبی.',
  },
  {
    title: 'پرسنل و برنامه کاری',
    text: 'تعریف همکاران، تخصص‌های قابل انجام و ساعت کاری هر عضو تیم سالن.',
  },
  {
    title: 'صفحه عمومی سالن',
    text: 'نمایش اطلاعات و خدمات فعال سالن و دریافت درخواست نوبت از مشتریان.',
  },
  {
    title: 'اعلان و پیامک تایید',
    text: 'استفاده از کد تایید یک‌بارمصرف برای ورود امن کاربران و پیگیری اعلان‌های مهم.',
  },
] as const
