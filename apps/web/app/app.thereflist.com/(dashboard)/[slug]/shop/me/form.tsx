"use client";

import { Button } from "@dub/ui";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LinkFormData } from "@/ui/links/link-builder/link-form-data";
import { LoadingCircle } from "@dub/ui/icons";
import { toast } from "sonner";

export function MeForm() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [linkData, setLinkData] = useState<LinkFormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get the link data from localStorage
    const storedData = localStorage.getItem("shopLinkData");
    if (storedData) {
      setLinkData(JSON.parse(storedData));
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <LoadingCircle />
      </div>
    );
  }

  if (!linkData) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-neutral-500">No link data found.</p>
        <Button
          type="button"
          text="Create a new link"
          onClick={() => router.push("/shop")}
        />
      </div>
    );
  }

  const shortLink = `https://${linkData.domain}/${linkData.key}`;

  return (
    <div className="flex w-full flex-col gap-y-8 items-center" style={{ paddingBottom: 24 }}>
      {/* Card-style preview as clickable link */}
      <a
        href={shortLink}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full max-w-md rounded-2xl shadow-lg bg-white overflow-hidden flex flex-col transition-transform duration-150 hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-neutral-300 cursor-pointer"
      >
        {linkData.image && (
          <img
            src={linkData.image}
            alt={linkData.title || 'Product preview'}
            className="w-full object-cover aspect-[1/1.1] rounded-t-2xl"
          />
        )}
        <div className="flex flex-col gap-1 bg-neutral-100 p-4 rounded-b-2xl">
          <span className="text-base font-semibold text-neutral-900 truncate">
            {linkData.title || 'Untitled'}
          </span>
          <span className="text-sm text-neutral-500">refl.ist</span>
        </div>
      </a>

      {/* Action buttons below (no Open Link button) */}
      <div className="flex justify-end gap-4 w-full max-w-md mt-4">
        <Button
          type="button"
          text="Copy"
          onClick={() => {
            navigator.clipboard.writeText(shortLink);
            toast.success('Copied to clipboard!');
          }}
        />
        <Button
          type="button"
          text="Create another link"
          variant="secondary"
          onClick={() => router.push(`/${slug}/shop`)}
        />
        <Button
          type="button"
          text="Go to links"
          onClick={() => router.push('/links')}
        />
      </div>
    </div>
  );
} 