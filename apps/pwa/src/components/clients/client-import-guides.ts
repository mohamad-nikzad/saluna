import type { GuideSegment } from '#/lib/guide-text'

export type ImportGuideDifficulty = 'easy' | 'medium' | 'hard'

export type ImportGuidePlatform = {
  id: string
  nameSegments: GuideSegment[]
  subtitleSegments: GuideSegment[]
  brandSlug: string
  difficulty: ImportGuideDifficulty
  stepCount: number
  steps: GuideSegment[][]
  pitfalls: GuideSegment[][]
  outputSegments: GuideSegment[]
  notRecommended?: boolean
}

export const DIFFICULTY_LABEL: Record<ImportGuideDifficulty, string> = {
  easy: 'آسان',
  medium: 'متوسط',
  hard: 'دشوار',
}

const en = (text: string): GuideSegment => ({ type: 'en', text })
const fa = (text: string): GuideSegment => ({ type: 'fa', text })

export const IMPORT_GUIDE_PLATFORMS: ImportGuidePlatform[] = [
  {
    id: 'ios',
    nameSegments: [fa('آیفون'), en('iOS')],
    subtitleSegments: [
      fa('از اپ '),
      en('Contacts'),
      fa(' همه مخاطبین رو یک‌جا به فایل تبدیل کنید.'),
    ],
    brandSlug: 'apple',
    difficulty: 'easy',
    stepCount: 6,
    steps: [
      [
        fa('اپ '),
        en('Contacts'),
        fa(' را باز کنید (یا '),
        en('Phone'),
        fa(' → تب '),
        en('Contacts'),
        fa(').'),
      ],
      [fa('روی '), en('Lists'), fa(' (بالا سمت چپ) بزنید.')],
      [
        fa('لیست موردنظر را نگه دارید — معمولاً '),
        en('All Contacts'),
        fa(' یا '),
        en('iCloud'),
        fa('.'),
      ],
      [fa(''), en('Export'), fa(' را بزنید.')],
      [
        fa('فیلدها را انتخاب کنید → '),
        en('Done'),
        fa(' ('),
        en('Select All Fields'),
        fa(' برای پشتیبان کامل).'),
      ],
      [
        fa(''),
        en('Save to Files'),
        fa(' را بزنید و در '),
        en('On My iPhone'),
        fa(' یا '),
        en('iCloud Drive'),
        fa(' ذخیره کنید.'),
      ],
    ],
    pitfalls: [
      [
        fa('هر لیست جدا فایل می‌شه — '),
        en('All Contacts'),
        fa(' را انتخاب کنید.'),
      ],
      [fa('مخاطبین فقط در اپ‌های ثالث ممکن است جا بمانند.')],
      [
        fa('برای لیست‌های بزرگ '),
        en('Save to Files'),
        fa(' قابل‌اعتمادتر از '),
        en('AirDrop'),
        fa(' است.'),
      ],
    ],
    outputSegments: [
      fa('یک فایل '),
      en('.vcf'),
      fa(' (مثلاً '),
      en('All Contacts.vcf'),
      fa(')'),
    ],
  },
  {
    id: 'android',
    nameSegments: [fa('اندروید'), en('Google')],
    subtitleSegments: [
      en('Fix & manage'),
      fa(' → '),
      en('Export to file'),
      fa(' در '),
      en('Google Contacts'),
      fa('.'),
    ],
    brandSlug: 'google',
    difficulty: 'easy',
    stepCount: 5,
    steps: [
      [
        fa('اپ '),
        en('Contacts'),
        fa(' ('),
        en('Google Contacts'),
        fa(') را باز کنید.'),
      ],
      [en('Fix & manage'), fa(' (پایین صفحه) را بزنید.')],
      [en('Export to file'), fa(' را انتخاب کنید.')],
      [fa('حساب(های) '), en('Google'), fa(' موردنظر را انتخاب کنید.')],
      [
        en('Export to .VCF file'),
        fa(' → فایل در '),
        en('Downloads'),
        fa(' ذخیره می‌شود.'),
      ],
    ],
    pitfalls: [
      [
        fa('هر حساب جدا فایل می‌شه — برای هر حساب '),
        en('Google'),
        fa(' تکرار کنید.'),
      ],
      [
        fa('مخاطبین '),
        en('SIM'),
        fa(' شاید تو فایل نیان؛ فیلتر '),
        en('All contacts'),
        fa(' را بزنید.'),
      ],
    ],
    outputSegments: [
      fa('یک فایل '),
      en('.vcf'),
      fa(' per حساب (معمولاً '),
      en('contacts.vcf'),
      fa(')'),
    ],
  },
  {
    id: 'samsung',
    nameSegments: [fa('سامسونگ '), en('Galaxy')],
    subtitleSegments: [
      en('Manage contacts'),
      fa(' → '),
      en('Export'),
      fa(' در '),
      en('Samsung Contacts'),
      fa('.'),
    ],
    brandSlug: 'samsung',
    difficulty: 'easy',
    stepCount: 6,
    steps: [
      [
        fa('اپ '),
        en('Contacts'),
        fa(' را باز کنید (نه فقط تب '),
        en('Phone'),
        fa(').'),
      ],
      [
        en('☰'),
        fa(' یا '),
        en('⋮'),
        fa(' → '),
        en('Manage contacts'),
        fa('.'),
      ],
      [en('Import or export contacts'), fa(' → '), en('Export'), fa('.')],
      [
        en('Internal storage'),
        fa(' / '),
        en('Downloads'),
        fa(' را به‌عنوان مقصد انتخاب کنید.'),
      ],
      [en('Export'), fa(' / '), en('Done'), fa(' را بزنید.')],
      [
        fa('فایل را در '),
        en('My Files'),
        fa(' → '),
        en('Downloads'),
        fa(' پیدا کنید.'),
      ],
    ],
    pitfalls: [
      [
        en('Contacts to display'),
        fa(' را روی '),
        en('All contacts'),
        fa(' بگذارید.'),
      ],
      [
        fa('اشتراک تک‌مخاطب از '),
        en('Samsung'),
        fa(' گاهی خطا می‌دهد — گرفتن فایل همه مخاطبین بهتره.'),
      ],
    ],
    outputSegments: [
      fa('یک فایل '),
      en('.vcf'),
      fa(' ('),
      en('Contacts.vcf'),
      fa(' یا با تاریخ)'),
    ],
  },
  {
    id: 'xiaomi',
    nameSegments: [fa('شیائومی '), en('HyperOS'), fa(' / '), en('MIUI')],
    subtitleSegments: [
      en('Manage'),
      fa(' → '),
      en('Export to file'),
      fa(' در '),
      en('Contacts'),
      fa('.'),
    ],
    brandSlug: 'xiaomi',
    difficulty: 'easy',
    stepCount: 5,
    steps: [
      [en('Contacts'), fa(' را باز کنید.')],
      [en('Manage'), fa(' (پایین یا منو) را بزنید.')],
      [
        en('Export to file'),
        fa(' / '),
        en('Export to storage'),
        fa(' را انتخاب کنید.'),
      ],
      [
        fa('حساب ('),
        en('Google'),
        fa('، '),
        en('Xiaomi'),
        fa('، '),
        en('phone'),
        fa(') را انتخاب و '),
        en('Export'),
        fa(' بزنید.'),
      ],
      [fa('محل ذخیره را تأیید کنید → '), en('Save'), fa('.')],
    ],
    pitfalls: [
      [
        fa('انتخاب چند مخاطب برای '),
        en('VCF'),
        fa(' یکجا ممکن نیست — کل حساب یک‌جا توی فایل می‌ره.'),
      ],
      [
        en('MIUI'),
        fa(' قدیم: '),
        en('Settings'),
        fa(' → '),
        en('Import/Export'),
        fa(' → '),
        en('Export to storage'),
        fa('.'),
      ],
    ],
    outputSegments: [fa('یک فایل '), en('.vcf'), fa(' per حساب')],
  },
  {
    id: 'huawei',
    nameSegments: [fa('هواوی '), en('EMUI'), fa(' / '), en('HarmonyOS')],
    subtitleSegments: [
      en('Settings'),
      fa(' → '),
      en('Import/Export'),
      fa(' → '),
      en('Export to storage'),
      fa('.'),
    ],
    brandSlug: 'huawei',
    difficulty: 'medium',
    stepCount: 6,
    steps: [
      [
        en('Contacts'),
        fa(' (یا '),
        en('Phone'),
        fa(' → '),
        en('Contacts'),
        fa(') را باز کنید.'),
      ],
      [en('⋮'), fa(' یا '), en('☰'), fa(' → '), en('Settings'), fa('.')],
      [en('Import/Export'), fa('.')],
      [
        en('Export to storage'),
        fa(' (نه '),
        en('SIM'),
        fa(' — محدودیت ~۲۵۰ مخاطب).'),
      ],
      [en('Export'), fa(' / '), en('OK'), fa(' را بزنید.')],
      [
        en('Files'),
        fa(' → '),
        en('Internal storage'),
        fa(' (اغلب ریشه، نه '),
        en('Downloads'),
        fa(').'),
      ],
    ],
    pitfalls: [
      [
        fa('مسیر پیش‌فرض ریشه storage — '),
        en('Downloads'),
        fa(' را هم چک کنید.'),
      ],
      [
        fa('بدون '),
        en('Google'),
        fa(': فایل‌گیری از خود گوشی کار می‌کنه؛ '),
        en('HiSuite'),
        fa(' روی PC پشتیبان.'),
      ],
    ],
    outputSegments: [
      fa('یک فایل '),
      en('.vcf'),
      fa(' (اغلب '),
      en('00001.vcf'),
      fa(')'),
    ],
  },
  {
    id: 'whatsapp',
    nameSegments: [fa('واتساپ')],
    subtitleSegments: [
      fa('واتساپ '),
      en('VCF'),
      fa(' گروهی ندارد — اول در '),
      en('Contacts'),
      fa(' ذخیره کنید.'),
    ],
    brandSlug: 'whatsapp',
    difficulty: 'hard',
    stepCount: 4,
    steps: [
      [
        fa('هر مشتری: چت → نام → '),
        en('Save to Contacts'),
        fa(' / '),
        en('Add to Contacts'),
        fa('.'),
      ],
      [fa('تا همه در '), en('Contacts'), fa(' گوشی باشند تکرار کنید.')],
      [
        fa('راهنمای برند گوشی خود را برای گرفتن فایل '),
        en('.vcf'),
        fa(' دنبال کنید.'),
      ],
      [fa('فایل '), en('.vcf'), fa(' را اینجا بارگذاری کنید.')],
    ],
    pitfalls: [
      [fa('دکمه گرفتن همه مخاطبین یا اعضای گروه یک‌جا نیست.')],
      [fa('نام نمایشی واتساپ ≠ نام ذخیره‌شده در '), en('Contacts'), fa('.')],
      [fa('برای لیست سلامون از '), en('Contacts'), fa(' گوشی استفاده کنید.')],
    ],
    outputSegments: [fa('فایل گروهی نداره — فقط '), en('per-contact share')],
    notRecommended: true,
  },
]

export function getImportGuide(id: string): ImportGuidePlatform | undefined {
  return IMPORT_GUIDE_PLATFORMS.find((p) => p.id === id)
}
