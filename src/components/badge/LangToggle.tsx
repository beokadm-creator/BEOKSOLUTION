import React from "react";

type LangToggleProps = {
  badgeLang: "ko" | "en";
  setBadgeLang: (lang: "ko" | "en") => void;
};

const LangToggle: React.FC<LangToggleProps> = ({ badgeLang, setBadgeLang }) => (
  <div className="flex justify-end gap-2">
    <button
      type="button"
      onClick={() => setBadgeLang("ko")}
      className={`rounded-full px-3 py-1 text-xs font-bold ${badgeLang === "ko" ? "bg-[#003366] text-white" : "border border-[#c3daee] bg-white text-[#003366]"}`}
    >
      KO
    </button>
    <button
      type="button"
      onClick={() => setBadgeLang("en")}
      className={`rounded-full px-3 py-1 text-xs font-bold ${badgeLang === "en" ? "bg-[#003366] text-white" : "border border-[#c3daee] bg-white text-[#003366]"}`}
    >
      EN
    </button>
  </div>
);

export default LangToggle;
