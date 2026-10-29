import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import useAuthUser from "../hooks/useAuthUser";
import { updateLanguages } from "../lib/api";
import LanguagePicker from "../components/LanguagePicker";

const ProfilePage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();

  const [langs, setLangs] = useState({
    nativeLanguage: authUser?.nativeLanguage || "",
    learningLanguage: authUser?.learningLanguage || "",
    knownLanguages: authUser?.knownLanguages || [],
  });

  const { mutate, isPending } = useMutation({
    mutationFn: updateLanguages,
    onSuccess: () => {
      toast.success("Languages updated");
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Update failed"),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Language Preferences</h1>
        <LanguagePicker value={langs} onChange={setLangs} />
        <button className="btn btn-primary" disabled={isPending} onClick={() => mutate(langs)}>
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
};
export default ProfilePage;