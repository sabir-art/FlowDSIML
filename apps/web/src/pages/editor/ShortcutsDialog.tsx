import { Fragment, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

/** ⌘ sur Mac, Ctrl ailleurs. */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * L12-06 : modale « Raccourcis clavier » (touche ? ou menu « … »). Quatre groupes en deux colonnes ;
 * seuls les raccourcis réellement disponibles sont listés.
 */
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const ctrl = isMac ? '⌘' : 'Ctrl';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const k = (...keys: string[]) =>
    keys.map((x, i) => (
      <Fragment key={i}>
        {x === '+' ? <span className="kb-sep">{t('editor.keys.then')}</span> : <kbd>{x}</kbd>}
      </Fragment>
    ));
  const groups: Array<{ title: string; rows: Array<[string, ReturnType<typeof k>]> }> = [
    {
      title: t('editor.keys.general'),
      rows: [
        [t('editor.keys.show'), k('?')],
        // L26-02 : aide intégrée
        [t('help.title'), k('F1')],
        [t('editor.keys.undo'), k(ctrl, 'Z')],
        [t('editor.keys.redo'), k(ctrl, t('editor.keys.shift'), 'Z')],
        [t('editor.keys.find'), k(ctrl, 'F')],
        [t('editor.keys.preview'), k(ctrl, t('editor.keys.enter'))],
      ],
    },
    {
      title: t('editor.keys.steps'),
      rows: [
        [t('editor.keys.prevNext'), k('↑', '↓')],
        [t('editor.keys.moveStep'), k(t('editor.keys.space'), '+', '↑', '↓')],
      ],
    },
    {
      title: t('editor.keys.canvas'),
      rows: [
        [t('editor.keys.hotspot'), k('H')],
        [t('editor.keys.blur'), k('B')],
        [t('editor.keys.moveItem'), k('←', '→', '↑', '↓')],
        [t('editor.keys.moveFast'), k(t('editor.keys.shift'), '←', '→')],
        [t('editor.keys.deleteItem'), k(t('editor.keys.del'))],
        [t('editor.keys.deselect'), k(t('editor.keys.esc'))],
      ],
    },
    {
      title: t('editor.keys.text'),
      rows: [
        [t('editor.keys.bold'), k(ctrl, 'B')],
        [t('editor.keys.italic'), k(ctrl, 'I')],
      ],
    },
  ];

  return createPortal(
    <div className="mk">
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal kb-modal" role="dialog" aria-modal="true" aria-labelledby="kb-t">
          <div className="modal-head">
            <h2 id="kb-t">{t('editor.shortcuts')}</h2>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t('common.close')}
              onClick={onClose}
              autoFocus
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="modal-body">
            <div className="kb-grid">
              {groups.map((g) => (
                <section key={g.title}>
                  <h3>{g.title}</h3>
                  <dl>
                    {g.rows.map(([label, keys]) => (
                      <Fragment key={label}>
                        <dt>{label}</dt>
                        <dd>{keys}</dd>
                      </Fragment>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
            <p className="help kb-help">{t('editor.keys.help')}</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
