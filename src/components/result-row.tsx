"use client";

import { useState } from "react";

import type { ScoredEntity } from "@/lib/types";
import { useCopy } from "./lang";
import { CopyMenu, Dot } from "./ui";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Highlight the probed terms inside the registered name. */
function Highlighted({ name, terms }: { name: string; terms: string[] }) {
  const usable = terms.filter((t) => t.length >= 3);
  if (!usable.length) return <>{name}</>;

  const pattern = new RegExp(
    `(${usable.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );

  return (
    <>
      {name.split(pattern).map((piece, i) =>
        usable.some((t) => t.toLowerCase() === piece.toLowerCase()) ? (
          <b key={i} className="font-semibold text-ink">
            {piece}
          </b>
        ) : (
          <span key={i}>{piece}</span>
        ),
      )}
    </>
  );
}

/**
 * A single register entry. Deliberately plain: name, one supporting line, and
 * the detail only if asked for. No cards, no borders, no badges competing for
 * attention — the risk colour is a single dot.
 */
export function ResultRow({ entity, terms }: { entity: ScoredEntity; terms: string[] }) {
  const { t } = useCopy();
  const [open, setOpen] = useState(false);
  const closed = entity.status === "Closed";

  const meta = [
    // Name the register explicitly for business names. A user checking a company
    // name needs to see that the clash is a registered trading name, not a company.
    entity.objectType === "ET-BUSINESS" ? t.businessName : null,
    [entity.location.region, entity.location.district].filter(Boolean).join(", ") || null,
    entity.year ? String(entity.year) : null,
    closed ? t.closedNote : null,
    entity.hasCharges ? t.chargesNote : null,
  ].filter(Boolean);

  /** The whole record as pasteable text, labelled in the current language. */
  const detailText = [
    entity.name,
    `${t.register}: ${entity.objectType === "ET-COMPANY" ? t.company : t.businessName}`,
    `${t.status}: ${entity.status ?? "—"}`,
    entity.subtype ? `${t.legalForm}: ${entity.subtype}` : null,
    entity.regDate ? `${t.registeredOn}: ${formatDate(entity.regDate)}` : null,
    entity.certNumber ? `${t.certificateNo}: ${entity.certNumber}` : null,
    entity.trackingNo ? `${t.trackingNo}: ${entity.trackingNo}` : null,
    entity.cessDate ? `${t.ceased}: ${formatDate(entity.cessDate)}` : null,
    entity.hasCharges ? `${t.charges}: ${t.chargesRegistered}` : null,
    entity.address ? `${t.address}: ${entity.address}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <li className="group py-3.5">
      <div className="flex items-start gap-2.5">
        {/* aligned to the cap height of the name, not the row box */}
        <span className="mt-[7px]">
          <Dot band={entity.band} />
        </span>

        <div className="min-w-0 flex-1">
          {/* The whole row toggles its own detail, so there is no per-row
              "details" link repeating itself down the page. */}
          <button
            type="button"
            onClick={() => setOpen((s) => !s)}
            aria-expanded={open}
            className="w-full cursor-pointer text-left"
          >
            <h3
              className={`text-[15px] leading-snug font-normal ${
                closed ? "text-muted" : "text-ink-soft"
              }`}
            >
              <Highlighted name={entity.name} terms={terms} />
            </h3>

            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
              <span className="tnum text-faint">{entity.score}</span>{" "}
              {/* Rendered from the match kind rather than the server's English
                  sentence, so the row reads in the chosen language. */}
              {t.reasons[entity.kind] ?? entity.reasons[0]}
              {meta.length > 0 && <span className="text-faint"> · {meta.join(" · ")}</span>}
            </p>
          </button>

          {open && (
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-3">
              <Detail label={t.register} value={entity.objectType === "ET-COMPANY" ? t.company : t.businessName} />
              <Detail label={t.matchType} value={t.kinds[entity.kind]} />
              <Detail label={t.distinctiveCore} value={entity.core || "—"} mono />
              <Detail label={t.status} value={entity.status ?? "—"} />
              <Detail label={t.legalForm} value={entity.subtype ?? "—"} />
              <Detail label={t.registeredOn} value={formatDate(entity.regDate) ?? "—"} />
              <Detail label={t.certificateNo} value={entity.certNumber ?? "—"} mono />
              <Detail label={t.trackingNo} value={entity.trackingNo ?? "—"} mono />
              {entity.cessDate && (
                <Detail label={t.ceased} value={formatDate(entity.cessDate) ?? "—"} />
              )}
              {entity.hasCharges && <Detail label={t.charges} value={t.chargesRegistered} />}
              <div className="col-span-2 sm:col-span-3">
                <Detail label={t.address} value={entity.address ?? "—"} />
              </div>
              {entity.reasons.length > 1 && (
                <div className="col-span-2 sm:col-span-3">
                  <Detail label={t.allSignals} value={entity.reasons.join(" · ")} />
                </div>
              )}
            </dl>
          )}
        </div>

        {/* Sibling of the row toggle, not a child: a button cannot nest inside
            another button. */}
        <span className="mt-0.5 shrink-0">
          <CopyMenu
            label={t.copy}
            doneLabel={t.copied}
            options={[
              { label: t.copyName, value: entity.name },
              { label: t.copyAll, value: detailText },
            ]}
          />
        </span>
      </div>
    </li>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd className={`mt-0.5 break-words text-ink-soft ${mono ? "font-mono tnum text-[11px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
