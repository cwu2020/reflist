"use client";

import { Button } from "@dub/ui";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

export function BuyerForm() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  useEffect(() => {
    // Get the link data from localStorage
    const storedData = localStorage.getItem("shopLinkData");
    if (!storedData) {
      router.push(`/${slug}/shop`);
    }
  }, [router, slug]);

  const handleOptionClick = (option: "me" | "friend") => {
    // Store the selected option in localStorage
    localStorage.setItem("shopBuyerOption", option);
    
    // Redirect to the appropriate page
    if (option === "me") {
      router.push(`/${slug}/shop/me`);
    } else {
      router.push(`/${slug}/shop/friend`);
    }
  };

  return (
    <div className="flex w-full flex-col gap-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleOptionClick("me")}
          className="flex flex-col items-center justify-center gap-4 rounded-lg border border-neutral-200 p-6 text-center transition-all hover:border-neutral-400"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
            <svg
              className="h-6 w-6 text-neutral-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-medium">For me</h3>
            <p className="mt-1 text-sm text-neutral-500">
              I want to earn cashback on my own purchases
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleOptionClick("friend")}
          className="flex flex-col items-center justify-center gap-4 rounded-lg border border-neutral-200 p-6 text-center transition-all hover:border-neutral-400"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
            <svg
              className="h-6 w-6 text-neutral-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-medium">For a friend</h3>
            <p className="mt-1 text-sm text-neutral-500">
              I want to create a link to share with someone else
            </p>
          </div>
        </button>
      </div>
    </div>
  );
} 