import { Contact, FileUp } from 'lucide-react'
import { Button } from '@repo/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/alert-dialog'

interface BulkClientAddSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPickFromContacts: () => void
  onPickFromFile: () => void
}

export function BulkClientAddSourceDialog({
  open,
  onOpenChange,
  onPickFromContacts,
  onPickFromFile,
}: BulkClientAddSourceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-start">
          <AlertDialogTitle>افزودن گروهی مشتریان</AlertDialogTitle>
          <AlertDialogDescription className="text-start">
            مشتریان را از مخاطبین گوشی انتخاب کنید یا با فایل VCF وارد کنید.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full touch-manipulation"
            onClick={() => {
              onOpenChange(false)
              onPickFromContacts()
            }}
          >
            <Contact className="size-4 shrink-0" />
            افزودن از مخاطبین
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full touch-manipulation"
            onClick={() => {
              onOpenChange(false)
              onPickFromFile()
            }}
          >
            <FileUp className="size-4 shrink-0" />
            افزودن با فایل vcf
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
