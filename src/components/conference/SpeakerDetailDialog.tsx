import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { Mic2, User } from "lucide-react";

type LocalizedValue = string | { [key: string]: string | undefined } | undefined;

export interface SpeakerDetailData {
  id?: string;
  name?: LocalizedValue;
  organization?: LocalizedValue;
  bio?: LocalizedValue;
  presentationTitle?: LocalizedValue;
  photoUrl?: string;
  sessionTime?: string;
}

interface SpeakerDetailDialogProps {
  speaker: SpeakerDetailData | null;
  lang?: string;
  onClose: () => void;
}

export function SpeakerDetailDialog({
  speaker,
  lang = "ko",
  onClose
}: SpeakerDetailDialogProps) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);

  const t = (value: LocalizedValue) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value[lang] || value.ko || value.en || "";
  };

  const speakerName = t(speaker?.name);
  const organization = t(speaker?.organization);
  const presentationTitle = t(speaker?.presentationTitle);
  const bio = t(speaker?.bio);
  const topicFallback = lang === "ko" ? "주제 미정" : "Topic TBD";
  const nameFallback = lang === "ko" ? "연자 정보" : "Speaker";
  const photoUrl = speaker?.photoUrl || "";
  const imageFailed = !!photoUrl && failedPhotoUrl === photoUrl;

  return (
    <Dialog open={!!speaker} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[86dvh] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl">
        <DialogTitle className="sr-only">
          {lang === "ko" ? "연자 상세 정보" : "Speaker details"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {lang === "ko" ? "연자, 소속, 발표 주제와 약력 정보" : "Speaker, affiliation, topic, and biography"}
        </DialogDescription>

        {speaker && (
          <div className="flex max-h-[86dvh] flex-col">
            <div className="flex items-start gap-4 border-b border-slate-100 bg-slate-50 px-5 py-5 pr-12 md:px-6 md:pr-14">
              <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-white bg-white shadow-sm md:h-28 md:w-24">
                {photoUrl && !imageFailed ? (
                  <img
                    src={photoUrl}
                    alt={speakerName}
                    className="h-full w-full object-contain"
                    loading="lazy"
                    onError={() => setFailedPhotoUrl(photoUrl)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100">
                    <User className="h-9 w-9 text-slate-400" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-xs font-semibold uppercase text-blue-600">
                  {lang === "ko" ? "연자" : "Speaker"}
                </p>
                <h2 className="mt-1 break-keep text-2xl font-bold leading-tight text-slate-950 md:text-3xl">
                  {speakerName || nameFallback}
                </h2>
                {(organization || speaker.sessionTime) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium leading-relaxed text-slate-600 md:text-base">
                    {organization && <span className="break-keep">{organization}</span>}
                    {organization && speaker.sessionTime && <span className="text-slate-300">|</span>}
                    {speaker.sessionTime && (
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                        {speaker.sessionTime}
                      </span>
                    )}
                  </div>
                )}
              </div>

            </div>

            <div className="overflow-y-auto px-5 py-5 md:px-6 md:py-6">
              <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Mic2 className="h-4 w-4" />
                  </span>
                  {lang === "ko" ? "발표 주제" : "Presentation Topic"}
                </div>
                <p className="break-keep text-lg font-bold leading-relaxed text-slate-950 md:text-xl">
                  {presentationTitle || <span className="text-slate-400">{topicFallback}</span>}
                </p>
              </section>

              {bio && (
                <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                  <h3 className="mb-3 text-sm font-bold text-slate-900">
                    {lang === "ko" ? "약력" : "Biography"}
                  </h3>
                  <div className="whitespace-pre-wrap break-keep text-sm leading-7 text-slate-700 md:text-base">
                    {bio}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
