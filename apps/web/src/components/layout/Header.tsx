"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, Plus } from "lucide-react";
import { RunAssessmentModal } from "@/components/RunAssessmentModal";

export function Header() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");

  useEffect(() => {
    setSearchValue(searchParams.get("q") || "");
  }, [searchParams]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    const params = new URLSearchParams(searchParams);
    if (val) {
      params.set("q", val);
    } else {
      params.delete("q");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-zinc-800 bg-black shrink-0">
      <label className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl w-80 focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all cursor-text">
        <Search size={16} className="text-zinc-500 shrink-0" />
        <input
          type="text"
          value={searchValue}
          onChange={handleSearch}
          placeholder="Search campaigns, targets..."
          className="bg-transparent border-none text-white text-sm w-full outline-none placeholder:text-zinc-500"
        />
      </label>

      <RunAssessmentModal 
        isOpen={isAssessmentModalOpen} 
        onClose={() => setIsAssessmentModalOpen(false)} 
        targetId={null} 
        onSuccess={() => {
          setIsAssessmentModalOpen(false);
          if (window.location.pathname === "/campaigns" || window.location.pathname === "/dashboard") {
            window.location.reload(); // Refresh to show new campaign
          } else {
            router.push("/campaigns");
          }
        }} 
      />

      <div className="flex items-center gap-4">
        <button
          className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]"
          onClick={() => router.push('/targets')}
        >
          <Plus size={16} />
          Add Target
        </button>
      </div>
    </header>
  );
}
