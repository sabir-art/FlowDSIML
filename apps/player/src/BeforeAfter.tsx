import { useState } from 'preact/hooks';
import { ChevronRight, MoveHorizontal } from 'lucide-preact';
import type { ImageRef, Mask, Step } from '@flowdsiml/manifest';
import type { Dict } from './i18n';
import { Slider } from './Slider';

const ICON = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;

function Shot({ img, blurs, alt }: { img: ImageRef; blurs: Mask[]; alt: string }) {
  return (
    <div class="p-ba-shot" style={{ '--ratio': String(img.width / img.height) }}>
      <img src={img.url} alt={alt} draggable={false} />
      {blurs.map((b, i) => (
        <div
          key={i}
          class={`p-blur${b.style === 'solid' ? ' p-blur--solid' : b.style === 'pixels' ? ' p-blur--pixels' : ''}`}
          style={{
            left: `${b.x * 100}%`,
            top: `${b.y * 100}%`,
            width: `${b.w * 100}%`,
            height: `${b.h * 100}%`,
            ...(b.style === 'solid' ? { background: b.color } : {}),
          }}
        >
          {b.style === 'solid' && b.text ? <span>{b.text}</span> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * L17-03 à 05 : étape Avant / Après dans le lecteur. Côte à côte, curseur (pas de 5 %) ou bascule ;
 * la bascule est imposée sous 640 px. « Avant » : pilule neutre, capture désaturée ; « Maintenant » :
 * pilule verte. Les notes et « Suivant » sont dans la carte du bas.
 */
export function BeforeAfterStep({
  step,
  narrow,
  t,
  sub,
  html,
  nextLabel,
  onNext,
  stepLabel,
}: {
  step: Step;
  narrow: boolean;
  t: Dict;
  sub: (s: string) => string;
  html: (s: string) => string;
  nextLabel: string;
  onNext: () => void;
  stepLabel: string;
}) {
  const ba = step.beforeAfter!;
  const after = step.image!;
  const layout = narrow ? 'toggle' : ba.layout;
  const lb = sub(ba.labels.before) || t.before;
  const la = sub(ba.labels.after) || t.after;
  const [value, setValue] = useState(50);
  const [showBefore, setShowBefore] = useState(false);
  // Spec §4 : « {{libellé}} : capture de l'écran, étape n sur N »
  const shot = t.shotAlt.charAt(0).toLowerCase() + t.shotAlt.slice(1);
  const altBefore = `${lb} : ${shot} ${stepLabel}`;
  const altAfter = `${la} : ${shot} ${stepLabel}`;

  const notes = (ba.notes.before || ba.notes.after) && (
    <span class="p-ba-notes">
      {ba.notes.before && (
        <span>
          <b>{lb} :</b> <span dangerouslySetInnerHTML={{ __html: html(ba.notes.before) }} />
        </span>
      )}
      {ba.notes.after && (
        <span>
          <b>{la} :</b> <span dangerouslySetInnerHTML={{ __html: html(ba.notes.after) }} />
        </span>
      )}
    </span>
  );

  return (
    <div class={`p-ba p-ba--${layout}`}>
      {layout === 'side' && (
        <div class="p-ba-side">
          <figure>
            <span class="p-ba-pill p-ba-pill--before">{lb}</span>
            <div class="p-ba-frame is-old">
              <Shot img={ba.before} blurs={ba.beforeBlurs} alt={altBefore} />
            </div>
          </figure>
          <figure>
            <span class="p-ba-pill p-ba-pill--after">{la}</span>
            <div class="p-ba-frame">
              <Shot img={after} blurs={step.blurs} alt={altAfter} />
            </div>
          </figure>
        </div>
      )}
      {layout === 'slider' && (
        <div class="p-ba-slider">
          <div class="p-ba-frame">
            {/* L17-04 : le curseur a exactement la largeur de la comparaison */}
            <div class="p-ba-col" style={{ '--ratio': String(after.width / after.height) }}>
              <div
                class="p-ba-cmp"
                role="img"
                aria-label={t.baCompare.replace('{{before}}', lb).replace('{{after}}', la)}
              >
                <div class="p-ba-layer">
                  <Shot img={after} blurs={step.blurs} alt="" />
                </div>
                <div class="p-ba-layer is-old" style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}>
                  <Shot img={ba.before} blurs={ba.beforeBlurs} alt="" />
                </div>
                <span class="p-ba-bar" style={{ left: `${value}%` }} aria-hidden="true" />
                <span class="p-ba-knob" style={{ left: `${value}%` }} aria-hidden="true">
                  <MoveHorizontal {...ICON} />
                </span>
                {/* L17-04 : étiquettes au-dessus des captures (elles ne masquent rien) */}
                <div class="p-ba-tags" aria-hidden="true">
                  <span class="p-ba-pill p-ba-pill--before">{lb}</span>
                  <span class="p-ba-pill p-ba-pill--after">{la}</span>
                </div>
              </div>
              <Slider
                class="p-ba-range"
                min={0}
                max={100}
                step={5}
                value={value}
                label={t.baSlider}
                valueText={t.baSliderValue.replace('{{n}}', String(value))}
                onChange={setValue}
              />
            </div>
          </div>
        </div>
      )}
      {layout === 'toggle' && (
        <div class="p-ba-toggle">
          <div class="p-ba-seg" role="group" aria-label={t.baShow}>
            <button type="button" aria-pressed={showBefore} onClick={() => setShowBefore(true)}>
              {lb}
            </button>
            <button type="button" aria-pressed={!showBefore} onClick={() => setShowBefore(false)}>
              {la}
            </button>
          </div>
          <div class={`p-ba-frame${showBefore ? ' is-old' : ''}`}>
            {showBefore ? (
              <Shot img={ba.before} blurs={ba.beforeBlurs} alt={altBefore} />
            ) : (
              <Shot img={after} blurs={step.blurs} alt={altAfter} />
            )}
          </div>
        </div>
      )}
      <div class="p-ba-card">
        {notes}
        <button class="p-btn p-btn-primary" onClick={onNext}>
          {nextLabel}
          <ChevronRight {...ICON} size={16} />
        </button>
      </div>
    </div>
  );
}
