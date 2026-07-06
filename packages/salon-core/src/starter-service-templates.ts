export type StarterServiceTemplate = {
  name: string
  duration: number
  price: number
  color: string
}

export type StarterServiceCategoryTemplate = {
  category: string
  services: readonly StarterServiceTemplate[]
}

export const PERSIAN_STARTER_SERVICE_TEMPLATES: readonly StarterServiceCategoryTemplate[] =
  [
    {
      category: 'ناخن',
      services: [
        { name: 'کاشت پودری', duration: 120, price: 0, color: 'rose' },
        { name: 'کاشت ژل', duration: 120, price: 0, color: 'violet' },
        { name: 'ترمیم کاشت', duration: 90, price: 0, color: 'mint' },
        { name: 'مانیکور', duration: 45, price: 0, color: 'coral' },
        { name: 'پدیکور', duration: 60, price: 0, color: 'gold' },
        { name: 'لاک ژل دست', duration: 45, price: 0, color: 'rose' },
        { name: 'لاک ژل پا', duration: 45, price: 0, color: 'violet' },
      ],
    },
    {
      category: 'مو',
      services: [
        { name: 'کوتاهی مو', duration: 45, price: 0, color: 'coral' },
        { name: 'براشینگ مو', duration: 45, price: 0, color: 'gold' },
        { name: 'شینیون', duration: 90, price: 0, color: 'rose' },
        { name: 'رنگ ریشه', duration: 90, price: 0, color: 'violet' },
        { name: 'رنگ کامل مو', duration: 150, price: 0, color: 'rose' },
        { name: 'مش و هایلایت', duration: 180, price: 0, color: 'gold' },
        { name: 'آمبره و بالیاژ', duration: 210, price: 0, color: 'mint' },
        { name: 'کراتین مو', duration: 180, price: 0, color: 'coral' },
        { name: 'پروتئین تراپی مو', duration: 180, price: 0, color: 'violet' },
      ],
    },
    {
      category: 'پوست',
      services: [
        { name: 'فیشیال صورت', duration: 75, price: 0, color: 'mint' },
        { name: 'پاکسازی پوست', duration: 60, price: 0, color: 'coral' },
        { name: 'آبرسانی پوست', duration: 45, price: 0, color: 'gold' },
      ],
    },
    {
      category: 'مژه',
      services: [
        { name: 'اکستنشن کلاسیک مژه', duration: 120, price: 0, color: 'rose' },
        {
          name: 'اکستنشن والیوم مژه',
          duration: 150,
          price: 0,
          color: 'violet',
        },
        { name: 'ترمیم اکستنشن مژه', duration: 75, price: 0, color: 'mint' },
        { name: 'لیفت و لمینت مژه', duration: 75, price: 0, color: 'gold' },
      ],
    },
    {
      category: 'ابرو',
      services: [
        { name: 'اصلاح صورت و ابرو', duration: 30, price: 0, color: 'coral' },
        { name: 'رنگ ابرو', duration: 30, price: 0, color: 'gold' },
        { name: 'لیفت ابرو', duration: 60, price: 0, color: 'mint' },
        { name: 'فیبروز ابرو', duration: 150, price: 0, color: 'rose' },
        {
          name: 'میکروبلیدینگ ابرو',
          duration: 150,
          price: 0,
          color: 'violet',
        },
      ],
    },
    {
      category: 'آرایش دائم',
      services: [
        { name: 'بن مژه', duration: 120, price: 0, color: 'rose' },
        { name: 'خط چشم دائم', duration: 120, price: 0, color: 'violet' },
        { name: 'شیدینگ لب', duration: 150, price: 0, color: 'coral' },
        { name: 'ریموو تاتو', duration: 90, price: 0, color: 'mint' },
      ],
    },
    {
      category: 'اپیلاسیون',
      services: [
        { name: 'وکس صورت', duration: 30, price: 0, color: 'gold' },
        { name: 'اپیلاسیون بدن', duration: 90, price: 0, color: 'coral' },
      ],
    },
  ] as const
