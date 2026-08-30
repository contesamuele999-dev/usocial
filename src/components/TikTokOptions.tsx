"use client";

/**
 * Pannello delle opzioni TikTok, obbligatorio per il Direct Post.
 *
 * Le Content Sharing Guidelines pretendono che sia l'utente — non l'app — a
 * vedere su quale account sta pubblicando e a scegliere privacy, commenti,
 * duetto e stitch, con le voci disattivate dove il creator le ha disattivate.
 * Per questo i valori arrivano da `creator_info` a ogni apertura e il livello di
 * privacy parte VUOTO: preselezionarlo è esplicitamente vietato.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import type { CreatorInfo } from "@/social/types";
import type { TargetOptions } from "@/types";

const MUSIC_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const BRANDED_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";

export function TikTokOptions({
  value,
  onChange,
}: {
  value: TargetOptions;
  onChange: (next: TargetOptions) => void;
}) {
  const { t } = useI18n();
  const [info, setInfo] = useState<CreatorInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<CreatorInfo>("/api/accounts/tiktok/creator-info")
      .then(setInfo)
      .catch((err: Error) => setError(err.message));
  }, []);

  const set = (patch: Partial<TargetOptions>) => onChange({ ...value, ...patch });

  if (error) return <p className="mt-2 text-xs text-red-500">{t("tiktok.error", { msg: error })}</p>;
  if (!info) return <p className="mt-2 text-xs text-gray-500">{t("tiktok.loading")}</p>;

  /** Riga "consenti di…": spenta e bloccata se il creator l'ha disattivata su TikTok. */
  const interaction = (
    key: "comment" | "duet" | "stitch",
    blocked: boolean,
    disabled: boolean | undefined,
    patch: (on: boolean) => Partial<TargetOptions>
  ) => (
    <label
      key={key}
      className={`flex items-center gap-2 text-xs ${blocked ? "text-gray-400" : ""}`}
      title={blocked ? t("tiktok.disabledByCreator") : undefined}
    >
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-brand-600"
        disabled={blocked}
        checked={!blocked && !disabled}
        onChange={(e) => set(patch(e.target.checked))}
      />
      {t(`tiktok.${key}`)}
      {blocked && <span className="text-[10px]">({t("tiktok.disabledByCreator")})</span>}
    </label>
  );

  // La riga di consenso cambia se il video è dichiarato sponsorizzato: sono due
  // testi diversi imposti da TikTok, con i rispettivi link.
  const template = value.brandedContent ? t("tiktok.complianceBranded") : t("tiktok.compliance");
  const compliance = template.split(/(\{music\}|\{branded\})/).map((part, i) =>
    part === "{music}" ? (
      <a key={i} href={MUSIC_URL} target="_blank" rel="noreferrer" className="underline">
        {t("tiktok.musicPolicy")}
      </a>
    ) : part === "{branded}" ? (
      <a key={i} href={BRANDED_URL} target="_blank" rel="noreferrer" className="underline">
        {t("tiktok.brandedPolicy")}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );

  return (
    <div className="mt-2 space-y-2 rounded-md border border-gray-200 p-2 dark:border-gray-700">
      <div className="flex items-center gap-2">
        {info.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- avatar remoto su CDN TikTok, non ottimizzabile
          <img src={info.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
        )}
        <span className="text-xs text-gray-500">{t("tiktok.postingAs")}</span>
        <span className="text-xs font-medium">
          {info.nickname}
          {info.username ? ` (@${info.username})` : ""}
        </span>
      </div>

      <label className="block text-xs text-gray-500">
        {t("tiktok.privacy")}
        <select
          className="input mt-1 py-1 text-xs"
          value={value.privacyLevel || ""}
          onChange={(e) => set({ privacyLevel: e.target.value || undefined })}
        >
          <option value="">{t("tiktok.privacyPlaceholder")}</option>
          {info.privacyLevels.map((lv) => (
            <option
              key={lv}
              value={lv}
              // Un contenuto sponsorizzato non può essere privato: TikTok lo rifiuta.
              disabled={lv === "SELF_ONLY" && Boolean(value.brandedContent)}
            >
              {t(`tiktok.level.${lv}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1">
        <span className="text-xs text-gray-500">{t("tiktok.interactions")}</span>
        {interaction("comment", info.commentDisabled, value.disableComment, (on) => ({
          disableComment: !on,
        }))}
        {interaction("duet", info.duetDisabled, value.disableDuet, (on) => ({ disableDuet: !on }))}
        {interaction("stitch", info.stitchDisabled, value.disableStitch, (on) => ({
          disableStitch: !on,
        }))}
      </div>

      <div className="space-y-1 border-t border-gray-200 pt-2 dark:border-gray-700">
        <span className="text-xs text-gray-500">{t("tiktok.disclose")}</span>
        <p className="text-[10px] text-gray-400">{t("tiktok.discloseHint")}</p>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-brand-600"
            checked={Boolean(value.brandOrganic)}
            onChange={(e) => set({ brandOrganic: e.target.checked })}
          />
          {t("tiktok.brandOrganic")}
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-brand-600"
            checked={Boolean(value.brandedContent)}
            onChange={(e) =>
              set({
                brandedContent: e.target.checked,
                // Se il video era impostato come privato, la scelta non è più
                // valida: va rifatta invece di essere corretta di nascosto.
                privacyLevel:
                  e.target.checked && value.privacyLevel === "SELF_ONLY"
                    ? undefined
                    : value.privacyLevel,
              })
            }
          />
          {t("tiktok.brandedContent")}
        </label>
        {value.brandedContent && (
          <p className="text-[10px] text-amber-600">{t("tiktok.brandedNeedsPublic")}</p>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-gray-500">{compliance}</p>
    </div>
  );
}
