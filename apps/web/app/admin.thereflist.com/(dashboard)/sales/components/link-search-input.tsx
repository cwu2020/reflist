"use client";

import { useState } from "react";
import { useDebounce } from "use-debounce";
import { Input, LoadingCircle } from "@dub/ui";
import { fetcher } from "@dub/utils";
import useSWR from "swr";

interface LinkSearchInputProps {
  onSelect: (link: LinkData) => void;
}

interface LinkData {
  id: string;
  key: string;
  url: string;
  userId: string;
  user?: {
    email: string;
  };
  domain?: {
    slug: string;
  };
}

interface SearchResponse {
  links: LinkData[];
}

export function LinkSearchInput({ onSelect }: LinkSearchInputProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);
  
  const { data, isLoading, error } = useSWR<SearchResponse>(
    debouncedSearch.length > 2 
      ? `/api/admin/links/search?q=${encodeURIComponent(debouncedSearch)}`
      : null,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Input
          placeholder="Search by URL, ID, or key..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
        {isLoading && (
          <div className="absolute right-3 top-3">
            <LoadingCircle />
          </div>
        )}
      </div>
      
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-center text-sm text-red-800">
          Error loading links. Please try again.
        </div>
      )}
      
      {data?.links && (
        <div className="max-h-60 overflow-y-auto rounded-md border border-neutral-200">
          {data.links.length > 0 ? (
            <ul className="divide-y divide-neutral-200">
              {data.links.map((link) => (
                <li 
                  key={link.id}
                  className="cursor-pointer p-3 hover:bg-neutral-50"
                  onClick={() => {
                    onSelect(link);
                    setSearch("");
                  }}
                >
                  <div className="font-medium">{link.key}</div>
                  <div className="truncate text-sm text-neutral-500">{link.url}</div>
                  <div className="mt-1 text-xs text-neutral-400">
                    ID: {link.id} • User: {link.user?.email || "Unknown"}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-center text-sm text-neutral-500">
              No links found matching &quot;{debouncedSearch}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
} 