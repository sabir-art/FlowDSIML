/**
 * L46 : champ de texte riche (WYSIWYG) pour tout texte montré au visiteur. Gras, italique et liens
 * mis en forme (jamais de ** ou * visibles) ; variables en pastilles atomiques (libellé, jamais la clé),
 * insérées par « + Variable » ou en tapant {. Le format stocké ne change pas (lib/varText).
 * `singleLine` : titre, bouton… sans retour à la ligne ni barre de mise en forme.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Bold as BoldIcon, Italic as ItalicIcon, Link2, Plus } from 'lucide-react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import { NodeSelection } from '@tiptap/pm/state';
import { parseVarText, serializeVarText, varSource } from '../../../lib/varText';
import type { CatalogItem } from '../../../lib/varCatalog';
import { VarCatalog, VarSettings, markHelpSeen } from './VarPopovers';
import './vars.css';

type Pill = { pos: number; rect: DOMRect; key: string; fallback: string | null };

interface Ctx {
  catalog: CatalogItem[];
  aria: (label: string, fallback: string | null) => string;
  tip: (fallback: string) => string;
  deletedLabel: string;
  onOpen: (p: Pill) => void;
  renders: Set<() => void>;
}

/** Pastille de variable : nœud atomique (un seul caractère pour le curseur). */
const VariableNode = Node.create<{ ctx: { current: Ctx } }>({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  addOptions() {
    return { ctx: { current: null as unknown as Ctx } };
  },
  addAttributes() {
    return { key: { default: '' }, fallback: { default: null }, raw: { default: '' } };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-var]',
        getAttrs: (el) => ({
          key: (el as HTMLElement).dataset.var,
          fallback: (el as HTMLElement).dataset.fallback ?? null,
          raw: '',
        }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-var': node.attrs.key,
        'data-fallback': node.attrs.fallback ?? undefined,
      }),
      varSource(node.attrs as { key: string; fallback: string | null }),
    ];
  },
  renderText({ node }) {
    return varSource(node.attrs as { key: string; fallback: string | null; raw: string });
  },
  addNodeView() {
    const ctx = this.options.ctx;
    return ({ node: initial, getPos }) => {
      let node = initial;
      const dom = document.createElement('span');
      dom.contentEditable = 'false';
      dom.setAttribute('role', 'img');
      const render = () => {
        const c = ctx.current;
        const key = node.attrs.key as string;
        const fb = node.attrs.fallback as string | null;
        const item = c.catalog.find((x) => x.key === key);
        dom.className = `var-chip${item ? (item.group === 'workspace' ? ' var-chip--ws' : '') : ' var-chip--gone'}`;
        const label = item ? item.label : c.deletedLabel;
        // L46-01 : le nom seul ; le repli est dans l'infobulle et dans le réglage de la pastille
        dom.textContent = label;
        if (item && fb) dom.dataset.tip = c.tip(fb);
        else delete dom.dataset.tip;
        dom.setAttribute('aria-label', c.aria(label, item && fb ? fb : null));
      };
      render();
      ctx.current.renders.add(render);
      dom.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos == null) return;
        ctx.current.onOpen({
          pos,
          rect: dom.getBoundingClientRect(),
          key: node.attrs.key as string,
          fallback: (node.attrs.fallback as string | null) ?? null,
        });
      });
      return {
        dom,
        update: (n) => {
          if (n.type.name !== 'variable') return false;
          node = n;
          render();
          return true;
        },
        selectNode: () => dom.classList.add('is-selected'),
        deselectNode: () => dom.classList.remove('is-selected'),
        destroy: () => ctx.current.renders.delete(render),
        ignoreMutation: () => true,
      };
    };
  },
  addKeyboardShortcuts() {
    // Retour arrière ou Suppr à côté d'une pastille : la sélectionner d'abord, la supprimer ensuite
    const twoStep = (dir: -1 | 1) => () => {
      const { state, view } = this.editor;
      const sel = state.selection;
      if (sel instanceof NodeSelection) return false;
      if (!sel.empty) return false;
      const $p = sel.$from;
      const n = dir < 0 ? $p.nodeBefore : $p.nodeAfter;
      if (n?.type.name !== 'variable') return false;
      const pos = dir < 0 ? $p.pos - n.nodeSize : $p.pos;
      view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
      return true;
    };
    return {
      Backspace: twoStep(-1),
      Delete: twoStep(1),
      Enter: () => {
        const sel = this.editor.state.selection;
        if (sel instanceof NodeSelection && sel.node.type.name === 'variable') {
          const dom = this.editor.view.nodeDOM(sel.from) as HTMLElement | null;
          if (dom)
            this.options.ctx.current.onOpen({
              pos: sel.from,
              rect: dom.getBoundingClientRect(),
              key: sel.node.attrs.key as string,
              fallback: (sel.node.attrs.fallback as string | null) ?? null,
            });
          return true;
        }
        return false;
      },
    };
  },
});

export function VarTextField({
  id,
  label,
  value,
  onChange,
  catalog,
  disabled,
  singleLine = false,
  emailField = false,
  maxLength = 4000,
  canManage = false,
  rows = 4,
  placeholder,
  extra,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  catalog: CatalogItem[];
  disabled?: boolean;
  singleLine?: boolean;
  /** Champ d'e-mail ou de formulaire : l'e-mail du visiteur est proposé. */
  emailField?: boolean;
  maxLength?: number;
  canManage?: boolean;
  rows?: number;
  placeholder?: string;
  extra?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const items = useMemo(() => catalog.filter((c) => emailField || !c.emailOnly), [catalog, emailField]);
  const [cat, setCat] = useState<{ rect: DOMRect; brace: number | null } | null>(null);
  const [pill, setPill] = useState<Pill | null>(null);
  const addBtn = useRef<HTMLButtonElement>(null);
  const ctx = useRef<Ctx>({
    catalog,
    aria: (l, f) =>
      f ? t('variables.pillAriaFallback', { label: l, fallback: f }) : t('variables.pillAria', { label: l }),
    tip: (f) => t('variables.pillTip', { fallback: f }),
    deletedLabel: t('variables.deleted'),
    onOpen: (p) => setPill(p),
    renders: new Set(),
  });
  ctx.current.catalog = catalog;
  ctx.current.onOpen = (p) => setPill(p);
  const last = useRef(value);

  const editor = useEditor(
    {
      editable: !disabled,
      extensions: [
        Document,
        Paragraph,
        Text,
        History,
        VariableNode.configure({ ctx }),
        ...(singleLine
          ? []
          : [Bold, Italic, Link.configure({ openOnClick: false, autolink: false }), HardBreak]),
      ],
      content: parseVarText(singleLine ? value.replace(/\n/g, ' ') : value),
      editorProps: {
        attributes: (state) => ({
          id,
          role: 'textbox',
          'aria-multiline': singleLine ? 'false' : 'true',
          'aria-label': label,
          class: `var-rte__area${singleLine ? ' is-single' : ''}`,
          ...(singleLine ? {} : { style: `min-height:${rows * 22}px` }),
          ...(placeholder && state.doc.childCount === 1 && state.doc.firstChild?.childCount === 0
            ? { 'data-placeholder': placeholder, 'aria-placeholder': placeholder }
            : {}),
        }),
        handleKeyDown: (view, e) => {
          if (singleLine && e.key === 'Enter') return true;
          return false;
        },
        handleTextInput: (view, from, _to, text) => {
          if (text !== '{') return false;
          // { : ouvre le catalogue sous le curseur ; Échap le ferme en laissant le {
          requestAnimationFrame(() => {
            const c = view.coordsAtPos(from + 1);
            setCat({ rect: new DOMRect(c.left, c.top, 1, c.bottom - c.top), brace: from });
          });
          return false;
        },
        handlePaste: (view, e) => {
          const text = e.clipboardData?.getData('text/plain');
          if (!text || !/\{\{|\*|\[/.test(text)) return false;
          const doc = parseVarText(singleLine ? text.replace(/\n/g, ' ') : text);
          const nodes = doc.content[0]?.content ?? [];
          editorRef.current?.chain().focus().insertContent(nodes).run();
          return true;
        },
      },
      onUpdate: ({ editor: ed }) => {
        const out = serializeVarText(ed.getJSON() as never).slice(0, maxLength);
        last.current = out;
        onChange(out);
      },
    },
    [id, singleLine, label, placeholder],
  );
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // Valeur changée de l'extérieur (autre étape, annulation, IA) : on recharge le contenu
  useEffect(() => {
    if (!editor || value === last.current) return;
    last.current = value;
    editor.commands.setContent(parseVarText(value), false);
  }, [editor, value]);
  useEffect(() => editor?.setEditable(!disabled), [editor, disabled]);
  // Catalogue chargé ou modifié : les pastilles reprennent leurs libellés
  useEffect(() => ctx.current.renders.forEach((r) => r()), [catalog]);

  function insert(item: CatalogItem) {
    if (!editor) return;
    markHelpSeen();
    const chain = editor.chain().focus();
    if (cat?.brace != null) {
      const ch = editor.state.doc.textBetween(cat.brace, cat.brace + 1);
      if (ch === '{') chain.deleteRange({ from: cat.brace, to: cat.brace + 1 });
    }
    chain
      .insertContent([
        {
          type: 'variable',
          attrs: { key: item.key, fallback: item.computed ? null : item.fallback || null, raw: '' },
        },
        { type: 'text', text: ' ' },
      ])
      .run();
    setCat(null);
  }

  const toolBtn = (
    icon: React.ReactNode,
    name: string,
    shortcut: string,
    active: boolean,
    run: () => void,
  ) => (
    <button
      type="button"
      className={`var-rte__tool${active ? ' is-on' : ''}`}
      aria-label={name}
      aria-pressed={active}
      aria-keyshortcuts={shortcut}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {icon}
    </button>
  );
  const pillItem = pill ? (catalog.find((c) => c.key === pill.key) ?? null) : null;
  const len = value.length;

  return (
    <div className="field var-field">
      <label className="label" htmlFor={id} onClick={() => editor?.commands.focus()}>
        {label}
      </label>
      <div className={`var-rte${disabled ? ' is-disabled' : ''}${singleLine ? ' var-rte--single' : ''}`}>
        {!singleLine && !disabled && editor && (
          <div className="var-rte__bar">
            {toolBtn(
              <BoldIcon aria-hidden="true" />,
              t('editor.bold'),
              'Control+B',
              editor.isActive('bold'),
              () => editor.chain().focus().toggleBold().run(),
            )}
            {toolBtn(
              <ItalicIcon aria-hidden="true" />,
              t('editor.italic'),
              'Control+I',
              editor.isActive('italic'),
              () => editor.chain().focus().toggleItalic().run(),
            )}
            {toolBtn(
              <Link2 aria-hidden="true" />,
              t('editor.link'),
              'Control+K',
              editor.isActive('link'),
              () => {
                if (editor.isActive('link')) return editor.chain().focus().unsetLink().run();
                const url = window.prompt(t('editor.link'), 'https://');
                if (url && /^https?:\/\//.test(url)) editor.chain().focus().setLink({ href: url }).run();
              },
            )}
            <span className="grow" />
            {addButton()}
          </div>
        )}
        <EditorContent editor={editor} />
        {singleLine && !disabled && addButton()}
      </div>
      {!singleLine && (
        <span className="help">
          {t('editor.chars', { n: len, max: maxLength })}
          {extra}
        </span>
      )}
      {catalog.length > 0 &&
        /\{\{/.test(value) &&
        value
          .match(/\{\{\s*([a-z][a-z0-9_]{0,39})/g)
          ?.some((m) => !catalog.some((c) => c.key === m.replace(/\{\{\s*/, ''))) && (
          <span className="help var-gone-help">{t('variables.deletedHelp')}</span>
        )}
      {cat && (
        <VarCatalog
          anchor={cat.rect}
          items={items}
          canManage={canManage}
          onPick={insert}
          onCreate={(name) => navigate(`/settings/variables?nouveau=${encodeURIComponent(name)}`)}
          onClose={() => {
            setCat(null);
            editor?.commands.focus();
          }}
        />
      )}
      {pill && editor && (
        <VarSettings
          anchor={pill.rect}
          item={pillItem}
          fallback={pill.fallback}
          onClose={() => {
            setPill(null);
            editor.commands.focus();
          }}
          onRemove={() => {
            editor
              .chain()
              .focus()
              .deleteRange({ from: pill.pos, to: pill.pos + 1 })
              .run();
            setPill(null);
          }}
          onApply={(fb) => {
            const node = editor.state.doc.nodeAt(pill.pos);
            if (node?.type.name === 'variable')
              editor.view.dispatch(
                editor.state.tr.setNodeMarkup(pill.pos, undefined, { ...node.attrs, fallback: fb || null }),
              );
            setPill(null);
            editor.commands.focus();
          }}
        />
      )}
    </div>
  );

  function addButton() {
    return (
      <button
        ref={addBtn}
        type="button"
        className="var-rte__add var-link"
        aria-haspopup="dialog"
        aria-expanded={!!cat}
        aria-label={t('variables.addLabel')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setCat({ rect: addBtn.current!.getBoundingClientRect(), brace: null })}
      >
        <Plus aria-hidden="true" />
        {t('variables.add')}
      </button>
    );
  }
}
