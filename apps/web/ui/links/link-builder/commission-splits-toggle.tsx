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
import { Plus, Trash } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useLinkBuilderKeyboardShortcut } from "./use-link-builder-keyboard-shortcut";

export const CommissionSplitsToggle = () => {
  const { slug, plan } = useWorkspace();
  const { control, setValue, register } = useFormContext<LinkFormData>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "commissionSplits" as any,
  });

  const [enableSplits, setEnableSplits] = useState(
    Boolean(fields && fields.length > 0)
  );

  // Use the keyboard shortcut `p` to toggle commission splits
  useLinkBuilderKeyboardShortcut(
    "p",
    () => {
      if (enableSplits) {
        // If already enabled, disable by removing all splits
        setValue("commissionSplits", [], { shouldDirty: true });
        setEnableSplits(false);
      } else {
        // If disabled, enable and add one empty split
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
    if (checked) {
      // Add one empty split
      append({ phoneNumber: "", splitPercent: 50 });
    } else {
      // Remove all splits
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
        <Switch checked={enableSplits} fn={handleToggle} />
      </label>

      {enableSplits && (
        <div className="space-y-4 rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Creator receives: <span className="font-bold">{creatorPercentage}%</span>
            </span>
            <Button 
              text="Add Split" 
              variant="secondary" 
              icon={<Plus className="h-3 w-3" />}
              onClick={handleAddSplit}
              disabled={creatorPercentage <= 1}
              className="px-2 py-1 h-8 text-xs"
            />
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Split #{index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor={`commissionSplits.${index}.phoneNumber`}>Phone Number</Label>
                  <Input 
                    id={`commissionSplits.${index}.phoneNumber`}
                    placeholder="+1xxxxxxxxxx" 
                    {...register(`commissionSplits.${index}.phoneNumber`)}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`commissionSplits.${index}.splitPercent`}>
                      Split Percentage
                    </Label>
                    <span className="text-sm font-medium">
                      {commissionSplits?.[index]?.splitPercent || 0}%
                    </span>
                  </div>
                  <input
                    id={`commissionSplits.${index}.splitPercent`}
                    type="range"
                    min={1}
                    max={99}
                    step={1}
                    className="w-full"
                    value={commissionSplits?.[index]?.splitPercent || 0}
                    onChange={(e) => 
                      setValue(`commissionSplits.${index}.splitPercent`, parseInt(e.target.value), {
                        shouldDirty: true,
                      })
                    }
                  />
                </div>
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