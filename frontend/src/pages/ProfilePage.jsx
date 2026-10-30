import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraIcon } from "lucide-react";
import toast from "react-hot-toast";
import useAuthUser from "../hooks/useAuthUser";
import { updateLanguages, updateProfile, uploadAvatar } from "../lib/api";
import LanguagePicker from "../components/LanguagePicker";

const MAX_BIO = 200;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ProfilePage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);

  const [bio, setBio] = useState(authUser?.bio || "");
  const [langs, setLangs] = useState({
    nativeLanguage: authUser?.nativeLanguage || "",
    learningLanguage: authUser?.learningLanguage || "",
    knownLanguages: authUser?.knownLanguages || [],
  });

  const refreshUser = () => queryClient.invalidateQueries({ queryKey: ["authUser"] });
  const onError = (err) => toast.error(err.response?.data?.message || "Something went wrong");

  const avatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      toast.success("Profile picture updated");
      refreshUser();
    },
    onError,
  });

  const bioMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      toast.success("Bio updated");
      refreshUser();
    },
    onError,
  });

  const langMutation = useMutation({
    mutationFn: updateLanguages,
    onSuccess: () => {
      toast.success("Languages updated");
      refreshUser();
    },
    onError,
  });

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allows picking the same file again
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > MAX_IMAGE_BYTES) return toast.error("Image must be under 10 MB");
    avatarMutation.mutate(file);
  };

  const bioUnchanged = bio.trim() === (authUser?.bio || "");

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-3xl space-y-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Your Profile</h1>

        {/* PHOTO */}
        <section className="flex items-center gap-4">
          <div className="relative size-24 rounded-full overflow-hidden bg-base-300">
            <img src={authUser?.profilePic} alt={authUser?.fullName} className="size-full object-cover" />
            {avatarMutation.isPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="loading loading-spinner" />
              </div>
            )}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={avatarMutation.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <CameraIcon className="size-4 mr-2" />
              Change photo
            </button>
            <p className="text-xs opacity-70 mt-1">JPG, PNG or WebP, up to 10 MB</p>
          </div>
        </section>

        {/* BIO */}
        <section className="space-y-2">
          <label className="label">
            <span className="label-text">Bio</span>
            <span className="label-text-alt">{bio.length}/{MAX_BIO}</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full h-24"
            value={bio}
            maxLength={MAX_BIO}
            onChange={(e) => setBio(e.target.value)}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={bioMutation.isPending || bioUnchanged || !bio.trim()}
            onClick={() => bioMutation.mutate({ bio })}
          >
            {bioMutation.isPending ? "Saving..." : "Save bio"}
          </button>
        </section>

        {/* LANGUAGES */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Language Preferences</h2>
          <LanguagePicker value={langs} onChange={setLangs} />
          <button
            className="btn btn-primary btn-sm"
            disabled={langMutation.isPending}
            onClick={() => langMutation.mutate(langs)}
          >
            {langMutation.isPending ? "Saving..." : "Save languages"}
          </button>
        </section>
      </div>
    </div>
  );
};
export default ProfilePage;