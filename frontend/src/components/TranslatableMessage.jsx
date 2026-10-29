import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSimple, useMessageContext } from "stream-chat-react";
import { translateMessage } from "../lib/api";
import { capitialize } from "../lib/utils";

const TranslateBlock = ({ message }) => {
  const [open, setOpen] = useState(false);

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["translation", message.id, message.text],
    queryFn: () => translateMessage(message.id),
    enabled: open, // only call the API after the user clicks
    staleTime: Infinity, // a translation never goes stale
    gcTime: 60 * 60 * 1000,
    retry: false,
  });

  return (
    <div className="px-4 pb-2 text-sm">
      <button
        type="button"
        className="text-xs text-blue-600 hover:underline"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide translation" : "Translate"}
      </button>

      {open && (
        <div className="mt-1 rounded-lg bg-gray-100 p-2 text-gray-800">
          {isFetching && <span className="text-xs opacity-70">Translating...</span>}

          {isError && (
            <div className="flex items-center gap-2 text-xs text-red-600">
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
                <p>{data.translatedText}</p>
              </>
            ))}
        </div>
      )}
    </div>
  );
};

const TranslatableMessage = (props) => {
  const { message, isMyMessage } = useMessageContext();

  return (
    <>
      <MessageSimple {...props} />
      {!isMyMessage() && message.text && message.type !== "deleted" && (
        <TranslateBlock message={message} />
      )}
    </>
  );
};

export default TranslatableMessage;