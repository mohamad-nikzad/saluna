"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@repo/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { cn } from "@repo/ui/utils";
import type { Service } from "@repo/salon-core/types";
import { toPersianDigits } from "@repo/salon-core/persian-digits";
import {
  formatCompactServiceLabel,
  groupServicesByCatalog,
} from "@/components/services/service-catalog-groups";

interface ServicePickerProps {
  services: Service[];
  value?: string;
  onChange: (serviceId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showPrice?: boolean;
}

function formatTomans(price: number) {
  return `${new Intl.NumberFormat("fa-IR").format(price)} تومان`;
}

export function ServicePicker({
  services,
  value,
  onChange,
  placeholder = "انتخاب خدمت",
  disabled,
  showPrice = true,
}: ServicePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedService = useMemo(
    () => services.find((service) => service.id === value),
    [services, value],
  );
  const groups = useMemo(() => groupServicesByCatalog(services), [services]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-auto min-h-10 w-full justify-between gap-3 whitespace-normal px-3 py-2 text-start"
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              !selectedService && "text-muted-foreground",
            )}
          >
            {selectedService
              ? formatCompactServiceLabel(selectedService)
              : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(28rem,calc(100vw-2rem))] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) => {
            if (!search.trim()) return 1;
            return itemValue
              .toLocaleLowerCase("fa")
              .includes(search.toLocaleLowerCase("fa"))
              ? 1
              : 0;
          }}
        >
          <CommandInput placeholder="جستجوی دسته، خانواده یا خدمت..." />
          <CommandList className="max-h-88">
            <CommandEmpty>خدمتی پیدا نشد.</CommandEmpty>
            {groups.map((category) => (
              <CommandGroup
                key={category.categoryId}
                heading={category.categoryName}
              >
                {category.families.map((family) => (
                  <div key={family.familyId} className="py-1">
                    <div className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">
                      {family.familyName}
                    </div>
                    {family.services.map((service) => (
                      <CommandItem
                        key={service.id}
                        value={`${category.categoryName} ${family.familyName} ${service.name} ${service.id}`}
                        onSelect={() => {
                          onChange(service.id);
                          setOpen(false);
                        }}
                        className="items-start gap-3 py-2"
                      >
                        <Check
                          className={cn(
                            "mt-0.5 size-4",
                            value === service.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {service.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {toPersianDigits(service.duration)} دقیقه
                            {showPrice
                              ? ` · ${formatTomans(service.price)}`
                              : ""}
                          </span>
                        </span>
                      </CommandItem>
                    ))}
                  </div>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
