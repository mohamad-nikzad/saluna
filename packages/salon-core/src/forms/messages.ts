/**
 * Farsi error messages for shared form schemas.
 * Single source of truth — referenced by primitives and feature schemas.
 */
export const formMessages = {
  required: 'این فیلد الزامی است',
  phoneInvalid: 'شماره تلفن معتبر نیست',
  phoneTooShort: 'شماره تلفن باید حداقل ۱۰ رقم باشد',
  emailInvalid: 'ایمیل معتبر نیست',
  passwordTooShort: 'رمز عبور باید حداقل ۶ کاراکتر باشد',
  jalaliDateInvalid: 'تاریخ معتبر نیست',
  hexColorInvalid: 'رنگ معتبر نیست (مثلاً ‎#A1B2C3)',
  durationInvalid: 'مدت زمان باید عددی مثبت باشد',
  durationTooLong: 'مدت زمان بیش از حد مجاز است',
  priceInvalid: 'قیمت باید عددی صفر یا بیشتر باشد',
  priceTooHigh: 'قیمت بیش از حد مجاز است',
  numberInvalid: 'عدد معتبر نیست',
  endBeforeStart: 'زمان پایان باید بعد از زمان شروع باشد',
  timeInvalid: 'زمان معتبر نیست',
  dateInvalid: 'تاریخ معتبر نیست',
  clientRequired: 'انتخاب مشتری الزامی است',
  staffRequired: 'انتخاب پرسنل الزامی است',
  serviceRequired: 'انتخاب خدمت الزامی است',
  temporaryClientNameRequired: 'نام مشتری موقت الزامی است',
  bioTooLong: 'متن معرفی نمی‌تواند بیشتر از ۲۰۰ کاراکتر باشد',
} as const

export type FormMessageKey = keyof typeof formMessages
