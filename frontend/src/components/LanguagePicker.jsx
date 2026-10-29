import { LANGUAGES } from "../constants";
import { capitialize } from "../lib/utils";

const MAX_KNOWN = 5;

const LanguagePicker = ({ value, onChange }) => {
  const { nativeLanguage, learningLanguage, knownLanguages } = value;

  const toggleKnown = (lang) => {
    const exists = knownLanguages.includes(lang);
    if (!exists && knownLanguages.length >= MAX_KNOWN) return;
    onChange({
      ...value,
      knownLanguages: exists
        ? knownLanguages.filter((l) => l !== lang)
        : [...knownLanguages, lang],
    });
  };

  const options = LANGUAGES.map((l) => l.toLowerCase());

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label"><span className="label-text">Native Language</span></label>
          <select
            className="select select-bordered w-full"
            value={nativeLanguage}
            onChange={(e) => onChange({ ...value, nativeLanguage: e.target.value })}
          >
            <option value="">Select your native language</option>
            {options.map((l) => (
              <option key={l} value={l} disabled={l === learningLanguage}>{capitialize(l)}</option>
            ))}
          </select>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">Learning Language</span></label>
          <select
            className="select select-bordered w-full"
            value={learningLanguage}
            onChange={(e) => onChange({ ...value, learningLanguage: e.target.value })}
          >
            <option value="">Select language you're learning</option>
            {options.map((l) => (
              <option key={l} value={l} disabled={l === nativeLanguage}>{capitialize(l)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Other languages you know (max {MAX_KNOWN})</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {options
            .filter((l) => l !== nativeLanguage && l !== learningLanguage)
            .map((l) => (
              <button
                type="button"
                key={l}
                onClick={() => toggleKnown(l)}
                className={`btn btn-sm ${knownLanguages.includes(l) ? "btn-primary" : "btn-outline"}`}
              >
                {capitialize(l)}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};
export default LanguagePicker;