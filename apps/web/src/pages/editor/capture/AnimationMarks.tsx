import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TYPING_MS, scrollOffset, scrollPlan } from '@flowdsiml/player-core';
import { asStepOptions, type StepRow } from '../types';

/**
 * L25-04/05 : repères de l'animation sur le canevas (champ de la saisie, flèche et distance du
 * défilement) et lecture de l'aperçu (« Prévisualiser l'animation »), comme dans le lecteur.
 */
export function AnimationMarks({ step, urls }: { step: StepRow; urls: Record<string, string> }) {
  const { t, i18n } = useTranslation();
  const opts = asStepOptions(step.options);
  const anim = opts.animation;
  const fp = opts.fullPage;
  const [play, setPlay] = useState(0);
  const [chars, setChars] = useState<number | null>(null);
  const [go, setGo] = useState<boolean | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string>).detail === step.id) setPlay((n) => n + 1);
    };
    window.addEventListener('fd:anim-preview', on);
    return () => window.removeEventListener('fd:anim-preview', on);
  }, [step.id]);

  useEffect(() => {
    if (!play || !anim) return;
    if (anim.type === 'typing') {
      const total = [...anim.text].length;
      let n = 0;
      setChars(0);
      const id = setInterval(() => {
        n += 1;
        setChars(n);
        if (n >= total) {
          clearInterval(id);
          setTimeout(() => setChars(null), 600);
        }
      }, TYPING_MS[anim.speed]);
      return () => clearInterval(id);
    }
    setGo(false);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    const end = setTimeout(() => setGo(null), anim.duration * 1000 + 500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(end);
    };
    // Rejouée à chaque demande d'aperçu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  if (!anim) return null;
  if (anim.type === 'typing') {
    if (!anim.field) return null;
    const f = anim.field;
    const shown = chars === null ? anim.text : [...anim.text].slice(0, chars).join('');
    return (
      <div
        className={`cap-field-mark${chars !== null ? ' is-playing' : ''}`}
        style={{
          left: `${f.x * 100}%`,
          top: `${f.y * 100}%`,
          width: `${f.w * 100}%`,
          height: `${f.h * 100}%`,
        }}
        aria-hidden="true"
      >
        <span className="cap-chip">
          <Keyboard />
          {t('editor.capture.canvasTyping')}
          {anim.text && <span className="cap-chip-t">{anim.text}</span>}
        </span>
        {chars !== null && (
          <span className="cap-typed">
            {shown}
            <i className="cap-caret" />
          </span>
        )}
      </div>
    );
  }
  if (!fp) return null;
  const plan = scrollPlan(fp, anim);
  const Arrow = anim.direction === 'down' ? ArrowDown : ArrowUp;
  const src = fp.path ? urls[fp.path] : undefined;
  return (
    <>
      {go !== null && src && (
        <div className="cap-scroll" aria-hidden="true">
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              transform: `translateY(${scrollOffset(fp, go ? plan.to : plan.from)})`,
              transitionDuration: go ? `${anim.duration}s` : '0s',
            }}
          />
        </div>
      )}
      <span className={`cap-scroll-mark is-${anim.direction}`} aria-hidden="true">
        <span className="cap-chip">
          <Arrow />
          {t('editor.capture.canvasScroll', { n: Math.round(plan.distance).toLocaleString(i18n.language) })}
        </span>
      </span>
    </>
  );
}
