"use client";

import { useState, useRef } from "react";
import { Button } from "@dub/ui";
import { useRouter, useParams } from "next/navigation";
import { useForm, FormProvider, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { CommissionSplitsToggle } from "@/ui/links/link-builder/commission-splits-toggle";
import { LinkBuilderProvider } from "@/ui/links/link-builder/link-builder-provider";
import useWorkspace from "@/lib/swr/use-workspace";
import styles from "@/ui/links/link-builder/commission-splits-toggle.module.css";

export function FriendForm() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [step, setStep] = useState<"split" | "imessage">("split");
  const [loading, setLoading] = useState(false);
  const imessageRef = useRef<HTMLDivElement>(null);

  // Retrieve link data from localStorage
  const linkData = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("shopLinkData") || "null") : null;
  const shopmyRate = linkData?.shopmy?.rewardRate || 0;
  const linkId = linkData?.id;
  const workspace = useWorkspace();
  const workspaceId = workspace?.id || linkData?.workspaceId;

  // Setup react-hook-form
  const methods = useForm({
    defaultValues: {
      commissionSplits: linkData?.commissionSplits || [{ phoneNumber: "", splitPercent: 50 }],
    },
    mode: "onChange",
  });
  const { getValues } = methods;
  const commissionSplits = useWatch({ control: methods.control, name: "commissionSplits" });
  const isValid = commissionSplits && commissionSplits.length === 1 && commissionSplits[0].phoneNumber && commissionSplits[0].splitPercent > 0 && commissionSplits[0].splitPercent <= 100;

  // Handle Next
  const handleNext = async () => {
    setLoading(true);
    try {
      const splits = getValues("commissionSplits");
      const res = await fetch(`/api/links/${linkId}?workspaceId=${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionSplits: splits,
          friendPhone: splits[0].phoneNumber,
        }),
      });
      if (!res.ok) throw new Error("Failed to update link");
      // Save to localStorage for now
      localStorage.setItem("shopLinkData", JSON.stringify({
        ...linkData,
        commissionSplits: splits,
        friendPhone: splits[0].phoneNumber,
      }));
      setStep("imessage");
      setTimeout(() => {
        imessageRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      toast.success("Commission split and phone updated!");
    } catch (e) {
      toast.error("Failed to update link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Default iMessage draft
  let defaultMessage = "I saw this and thought of you.";
  if (typeof shopmyRate === "number" && !isNaN(shopmyRate) && shopmyRate > 0) {
    const cashback = ((shopmyRate * (commissionSplits?.[0]?.splitPercent || 0)) / 100).toFixed(2);
    defaultMessage = `I saw this and thought of you. If you use this link, you'll get ${cashback}% cash back :)`;
  } else {
    defaultMessage = "I saw this and thought of you. If you use this link, you'll get cash back :)";
  }
  const [imessage, setImessage] = useState(defaultMessage);

  // Get the recipient phone number from the first commission split
  const recipient = commissionSplits?.[0]?.phoneNumber || '';

  return (
    <LinkBuilderProvider workspace={workspace} modal={false} props={linkData}>
      <FormProvider {...methods}>
        <div className="flex flex-col gap-8" style={{ paddingBottom: 24 }}>
          <div className="flex flex-col gap-6">
            <CommissionSplitsToggle forceEnabled={true} />
            <Button
              type="button"
              text={loading ? "Saving..." : "Next"}
              disabled={!isValid || loading}
              onClick={handleNext}
              className="mt-2"
            />
          </div>
          {/* iMessage section always rendered, blurred until after Next */}
          <div
            ref={imessageRef}
            className={`flex flex-col gap-4 transition-all duration-300 ${step === "split" ? "pointer-events-none blur-sm opacity-60" : "pointer-events-auto blur-0 opacity-100"}`}
          >
            {/* Card-style link preview */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginRight: '12px' }}>
              <a
                href={linkData ? `https://${linkData.domain}/${linkData.key}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full max-w-md rounded-2xl shadow-lg bg-white overflow-hidden flex flex-col transition-transform duration-150 hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-neutral-300 cursor-pointer"
              >
                {linkData?.image && (
                  <img
                    src={linkData.image}
                    alt={linkData.title || 'Product preview'}
                    className="w-full object-cover aspect-[1/1.1] rounded-t-2xl"
                  />
                )}
                <div className="flex flex-col gap-1 bg-neutral-100 p-4 rounded-b-2xl">
                  <span className="text-base font-semibold text-neutral-900 truncate">
                    {linkData?.title || 'Untitled'}
                  </span>
                  <span className="text-sm text-neutral-500">refl.ist</span>
                </div>
              </a>
            </div>
            {/* iMessage bubble styled like iOS */}
            <div className="flex w-full justify-end">
              <div
                className={`${styles.imessageBubble} ${styles.last} ${step === "split" ? styles.imessageBubbleDisabled : ""}`}
                contentEditable={step !== "split"}
                suppressContentEditableWarning
                role="textbox"
                aria-label="iMessage Draft"
                tabIndex={0}
                onInput={e => setImessage((e.target as HTMLDivElement).innerText)}
                style={{ minHeight: 48 }}
              >
                {imessage}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 12 }}>
              <Button
                type="button"
                text="Copy Message"
                onClick={() => {
                  const link = linkData ? `https://${linkData.domain}/${linkData.key}` : '';
                  navigator.clipboard.writeText(`${imessage} ${link}`.trim());
                  toast.success("Message copied to clipboard!");
                }}
                disabled={step === "split"}
              />
              <Button
                type="button"
                text="Send via iMessage"
                onClick={() => {
                  // Get the recipient phone number from the first commission split
                  const recipient = commissionSplits?.[0]?.phoneNumber || '';
                  const link = linkData ? `https://${linkData.domain}/${linkData.key}` : '';
                  const smsBody = encodeURIComponent(`${imessage} ${link}`.trim());
                  window.open(`sms:${recipient}&body=${smsBody}`, '_blank');
                }}
                disabled={step === "split"}
              />
              <Button
                type="button"
                text="Create another link"
                variant="secondary"
                onClick={() => router.push(`/${slug}/shop`)}
              />
            </div>
          </div>
        </div>
      </FormProvider>
    </LinkBuilderProvider>
  );
} 