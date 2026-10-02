import { PUBLIC_MANAGER_APP_URL } from '@/env'
import { brand } from '@repo/brand'

export const displayClass = 'font-[family-name:var(--font-lalezar)]'

export const faqItems = [
  {
    question: `${brand.name.fa} چیست؟`,
    answer: `${brand.name.fa} نرم‌افزار مدیریت سالن زیبایی برای مدیران سالن است؛ با تمرکز روی نوبت‌ها، مشتریان، پرسنل، خدمات، صفحه عمومی سالن و درخواست نوبت.`,
  },
  {
    question: `آیا ${brand.name.fa} رزرو خودکار انجام می‌دهد؟`,
    answer:
      'خیر. صفحه عمومی سالن مسیر ثبت درخواست نوبت دارد، اما درخواست مشتری ابتدا توسط مدیر بررسی می‌شود و بعد از تایید به نوبت داخل تقویم تبدیل می‌شود.',
  },
  {
    question: `هزینه استفاده از ${brand.name.fa} چقدر است؟`,
    answer:
      'فعلا استفاده آزمایشی از سالونا رایگان است. پلن‌ها و قیمت‌گذاری بعد از شناخت بهتر بازار و نیاز سالن‌ها اعلام می‌شود.',
  },
  {
    question: 'آیا سالونا روی موبایل قابل استفاده است؟',
    answer:
      'بله. پنل مدیر به صورت وب‌اپ ساخته شده و برای استفاده روزانه روی موبایل و دسکتاپ طراحی شده است.',
  },
  {
    question: 'سالونا برای چه سالن‌هایی مناسب است؟',
    answer:
      'سالونا برای سالن‌های زیبایی، ناخن، مو، پوست، مژه، ابرو و اسپا طراحی شده؛ مخصوصا سالن‌هایی که می‌خواهند نوبت، مشتری، خدمات و پرسنل را منظم‌تر مدیریت کنند.',
  },
]

export const loginHref = new URL('/auth', PUBLIC_MANAGER_APP_URL).toString()
export const signupHref = new URL('/signup', PUBLIC_MANAGER_APP_URL).toString()
