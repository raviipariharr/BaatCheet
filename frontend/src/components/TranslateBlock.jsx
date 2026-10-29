import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { translateMessage } from "../lib/api";
import { capitialize } from "../lib/utils";
import useAuthUser from "../hooks/useAuthUser";

const TranslateBlock = ({ message }) => {
  const [open, setOpen] = useState(false);
  const { authUser } = useAuthUser();

  const { data, isFetching, isError, error, refetch } = useQuery({
    // native language is in the key: changing it in Profile must not show a stale translation
    queryKey: ["translation", message._id, authUser?.nativeLanguage],
    queryFn: () => translateMessage(message._id),
    enabled: open,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });

  return (
    <div className="max-w-[75%] text-sm">
      <button
        type="button"
        className="text-xs text-primary hover:underline"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide translation" : "Translate"}
      </button>

      {open && (
        <div className="mt-1 rounded-lg bg-base-200 p-2">
          {isFetching && <span className="text-xs opacity-70">Translating...</span>}

          {isError && (
            <div className="flex items-center gap-2 text-xs text-error">
              <span>{error.response?.data?.message || "Translation failed."}</span>
              <button type="button" className="underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}

          {data && !isFetching &&
            (data.sameLanguage ? (
              <span className="text-xs opacity-70">This message is already in your language.</span>
            ) : (
              <>
                <p className="mb-1 text-[10px] uppercase tracking-wide opacity-60">
                  Translated to {capitialize(data.targetLanguage)}
                </p>
                <p className="whitespace-pre-wrap break-words">{data.translatedText}</p>
              </>
            ))}
        </div>
      )}
    </div>
  );
};

export default TranslateBlock;