import useWorkspace from "@/lib/swr/use-workspace";
import { CommissionSplit, LinkFormData } from "@/ui/links/link-builder/link-form-data";
import {
  Button,
  InfoTooltip,
  Input,
  Label,
  SimpleTooltipContent,
  Switch,
} from "@dub/ui";
import { Plus, Trash, User, Gift } from "lucide-react";
import { useState, useEffect } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useLinkBuilderKeyboardShortcut } from "./use-link-builder-keyboard-shortcut";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import styles from "./commission-splits-toggle.module.css";

export const CommissionSplitsToggle = ({ forceEnabled = false }: { forceEnabled?: boolean }) => {
  const { slug, plan } = useWorkspace();
  const { control, setValue, register } = useFormContext<LinkFormData>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "commissionSplits" as any,
  });

  const [enableSplits, setEnableSplits] = useState(
    Boolean(fields && fields.length > 0)
  );

  // Always enable splits if forceEnabled is true
  useEffect(() => {
    if (forceEnabled) setEnableSplits(true);
    // If forceEnabled and no splits, append a default split
    if (forceEnabled && fields.length === 0) {
      append({ phoneNumber: "", splitPercent: 50 });
    }
  }, [forceEnabled, fields.length, append]);

  // Use the keyboard shortcut `p` to toggle commission splits
  useLinkBuilderKeyboardShortcut(
    "p",
    () => {
      if (forceEnabled) return;
      if (enableSplits) {
        setValue("commissionSplits", [], { shouldDirty: true });
        setEnableSplits(false);
      } else {
        append({ phoneNumber: "", splitPercent: 50 });
        setEnableSplits(true);
      }
    }
  );

  // Calculate the remaining percentage for the creator
  const commissionSplits = useWatch({
    control,
    name: "commissionSplits",
    defaultValue: [],
  }) as CommissionSplit[];

  const totalSplitPercentage = commissionSplits?.reduce(
    (sum, split) => sum + (split.splitPercent || 0),
    0
  ) || 0;

  const creatorPercentage = 100 - totalSplitPercentage;

  // Handle enabling/disabling splits
  const handleToggle = (checked: boolean) => {
    if (forceEnabled) return;
    if (checked) {
      append({ phoneNumber: "", splitPercent: 50 });
    } else {
      setValue("commissionSplits", [], { shouldDirty: true });
    }
    setEnableSplits(checked);
  };

  // Handle adding a new split recipient
  const handleAddSplit = () => {
    append({ phoneNumber: "", splitPercent: Math.min(50, creatorPercentage - 1) });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex select-none items-center gap-1 text-sm font-medium text-neutral-700">
            Commission Splits
            <InfoTooltip
              content={
                <SimpleTooltipContent
                  title="Share commissions with buyers by phone number."
                  cta="Learn more"
                  href="#"
                />
              }
            />
          </span>
        </div>
        {!forceEnabled && (
          <Switch checked={enableSplits} fn={handleToggle} />
        )}
      </label>

      {(enableSplits || forceEnabled) && (
        <div className="mx-auto max-w-md rounded-2xl bg-white shadow-lg p-8 flex flex-col gap-8">
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-6">
              {/* Removed Split #1 label since only one split is allowed */}
              {/* Percent boxes at the top */}
              <div className="mb-2 p-6 rounded-xl border border-neutral-100 bg-neutral-50">
                {/* Labels row */}
                <div className="flex gap-6 mb-2">
                  <div className="flex-1 flex justify-center">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-neutral-200 text-neutral-700 font-semibold text-sm">
                      <User className="w-4 h-4" /> For you
                    </span>
                  </div>
                  <div className="flex-1 flex justify-center">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                      <Gift className="w-4 h-4" /> For your friend
                    </span>
                  </div>
                </div>
                {/* Inputs row */}
                <div className="flex gap-6">
                  <div className="flex-1 flex flex-col items-center">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={100 - (commissionSplits?.[index]?.splitPercent || 0)}
                        readOnly
                        className="w-20 rounded-lg border px-3 py-2 text-center bg-neutral-100 font-semibold text-lg"
                      />
                      <span className="text-neutral-500 font-semibold text-lg">%</span>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={commissionSplits?.[index]?.splitPercent || 0}
                        onChange={e => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value)));
                          setValue(`commissionSplits.${index}.splitPercent`, val, { shouldDirty: true });
                        }}
                        className="w-20 rounded-lg border px-3 py-2 text-center font-semibold text-lg"
                      />
                      <span className="text-neutral-500 font-semibold text-lg">%</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Phone number input below */}
              <div className="flex flex-col gap-2">
                <Label htmlFor={`commissionSplits.${index}.phoneNumber`} className="text-base font-semibold text-neutral-700">Phone Number</Label>
                <PhoneInput
                  id={`commissionSplits.${index}.phoneNumber`}
                  defaultCountry="US"
                  international
                  countryCallingCodeEditable={true}
                  value={commissionSplits?.[index]?.phoneNumber || ""}
                  onChange={val => setValue(`commissionSplits.${index}.phoneNumber`, val || "", { shouldDirty: true })}
                  className={`w-full rounded-lg border px-3 py-2 text-lg ${styles["phone-input-custom"]}`}
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          ))}

          {totalSplitPercentage > 99 && (
            <div className="text-xs text-red-500">
              Total split percentage cannot exceed 99%. Please adjust the percentages.
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 