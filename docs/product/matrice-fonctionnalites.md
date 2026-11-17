# Matrice des fonctionnalités : parité Guideflow → FlowDSIML

Source : la page publique https://www.guideflow.com/pricing (tableau comparatif complet), relevée le 17/11/2026.
Objectif client : « développe tout ». Ce document sert de **plan de travail et de suivi**.

Statuts : ✅ fait · 🟡 partiel · ⬜ à faire · 🔑 à faire, mais dépend d'un compte ou d'une clé externe · 🤝 service humain (pas du code) · ⛔ hors périmètre technique (justifié)

Vagues :
- **A** : 100 % code, stack GitHub + Supabase, sans dépendance externe ;
- **B** : nécessite une clé, un compte tiers ou un domaine ;
- **C** : hors code ou très lourd.

## Products
| Fonction | Statut | Vague | Notes |
|---|---|---|---|
| Screenshot demo | ✅ | | |
| Mobile demo | ⬜ | A | Capture en émulation mobile, cadre téléphone dans le player |
| Demo page | ⬜ | A | Page publique hébergeant une démo (titre, texte, CTA, marque) |
| HTML-based demo | ⬜ | A | Snapshot DOM assaini (type rrweb), servi depuis le domaine de contenus |
| Sandbox demo | ⬜ | A | Pages HTML liées, navigation libre |
| Demo Center | ⬜ | A | Hub public de démos, catégories, marque |
| Live demo | ⛔ | C | Proxy de l'appli réelle : hors périmètre (sécurité, coût). Le sandbox HTML le remplace |

## Capture
| Fonction | Statut | Vague | Notes |
|---|---|---|---|
| Screenshot capture | ✅ | | |
| Video recording | ⬜ | A | tabCapture + MediaRecorder dans l'extension, étape « vidéo » |
| HTML-based capture | ⬜ | A | |
| Chrome extension | ✅ | | |
| MacOS app / Windows app | ⬜ | C | Tauri possible ; signature de code Apple et Microsoft nécessaire |
| Figma plugin | ⬜ | B | Plugin d'import des frames → étapes ; publication via un compte Figma |
| Multi-tabs capture | ⬜ | A | |
| Screen resizer | ⬜ | A | Redimensionne l'onglet à une résolution cible avant la capture |
| Animation (typing, scrolling) | ⬜ | A | Animations de saisie et de défilement dans le player |

## Edit
| Fonction | Statut | Vague |
|---|---|---|
| Plug & play builder, Hotspot, Add & edit steps, Add step informations, Demo preview | ✅ | |
| Walkthrough / Spotlight | 🟡 | A |
| Custom resolution, Resize & crop | ⬜ | A |
| Popup & chapter | 🟡 (chapitres ✅, pop-up ⬜) | A |
| Choose your own journey, Branching option | 🟡 (aller à l'étape ✅) | A |
| Multiple styles, Dark / Light mode | 🟡 | A |
| Customizable browser (cadre navigateur) | ⬜ | A |
| Autoplay, Pan & zoom | 🟡 (zoom ✅) | A |
| Video edition | ⬜ | A |
| Blur sensitive data (PII), Hide screen part | ✅ / 🟡 | A |
| Voiceover, Subtitles | ⬜ | A (manuel) / B (IA) |
| Webcam recording | ⬜ | A |
| Forms, Custom leads form | ✅ | |
| Survey, Checklist | ⬜ | A |
| Embed widget popup | ⬜ | A |
| A/B testing | ⬜ | A |
| Variable customization | ✅ | |
| Demo Versioning | ✅ | |
| Assets library | ⬜ | A |
| Presenter notes | 🟡 (commentaires internes ✅) | A |

## Personalize
| Fonction | Statut | Vague |
|---|---|---|
| Advanced no-code editor | 🟡 | A |
| Custom text & numbers, images & videos, charts & graphs | ⬜ (nécessite le HTML) | A |
| Dynamic variables | ✅ | |
| Find & replace, Bulk style editor, Apply design to all steps | ⬜ | A |
| Elements autolinking, Hide & blur / Remove HTML elements | ⬜ | A |
| Conditional branching | ⬜ | A |
| Upload custom datasets | ⬜ | A |

## AI (vague B : clé API Anthropic, plus un fournisseur TTS pour la voix)
| Fonction | Statut | Vague |
|---|---|---|
| AI-demo generation, AI-gen content, AI suggestions, AI assistant, AI chart editor, AI dataset generator | 🔑 | B (Claude API) |
| AI translate, AI subtitles | 🔑 | B (Claude API) |
| AI voiceover | 🔑 | B (TTS : ElevenLabs, Azure…) |
| Guideflow MCP (→ FlowDSIML MCP) | ⬜ | A (Edge Function MCP, clé d'API workspace) |
| AI visitor reveal, AI account reveal | 🔑 | B (service d'enrichissement IP→entreprise, question RGPD) |
| AI video avatar, AI video clone, AI-gen image | 🔑 | C (fournisseurs vidéo et image payants) |

## Share
| Fonction | Statut | Vague |
|---|---|---|
| Public link, Embed widget (iframe), Link expiration | ✅ | |
| Personalized page | 🟡 (liens perso ✅) | A |
| Video export (MP4), GIF export, PDF export | ⬜ | A (rendu dans le navigateur) |
| Custom link (slug) | ⬜ | A |
| Password protection, Email invitation, Authentification token, Domain-based access | ⬜ | A |
| Offline demos (export HTML autonome .zip) | ⬜ | A |
| Custom domain | 🔑 | B (nom de domaine) |

## Customize
| Fonction | Statut | Vague |
|---|---|---|
| Upload logo, Custom CTA, Remove watermark, Custom theme | ✅ | |
| Pre-defined style, Custom fonts, Custom public page | ⬜ | A |

## Analyze
| Fonction | Statut | Vague |
|---|---|---|
| General analytics, Session analytics, Navigation insights (entonnoir), Analytics export | ✅ | |
| Real-time data, Real-time alerts | ⬜ | A (Realtime ; alertes in-app + webhook / Slack) |
| Demographic & behavior, Device & platform tracking | ⬜ | A (user-agent, pays approximatif sans IP stockée) |
| Custom filters, Audience segmentation, Returning visitors | ⬜ | A |
| Forms & survey data | 🟡 | A |
| Leads identification & reveal, People & company enrichment | 🔑 | B |
| Webhook workflow (CRM, etc.) | ⬜ | A |

## Collaborate
| Fonction | Statut | Vague |
|---|---|---|
| Workspace organisation, Folder management, Role-based access, Brand management, Internal notes | ✅ | |
| Comments & notification | 🟡 (commentaires ✅, notifications ⬜) | A |
| Hotkeys & shortcuts, Tags, Theme management | ⬜ | A |
| Presenter Mode | ⬜ | A |
| Live presence indicator | ⬜ | A (Realtime Presence) |
| Flexible & secure rules | 🟡 | A |
| SSO, SCIM & SAML | 🔑 | B (SAML Supabase : plan payant) |

## Integration
| Fonction | Statut | Vague |
|---|---|---|
| Webhook, Resthook, Zapier (via webhooks et REST hooks) | ⬜ | A |
| Slack (webhook entrant) | ⬜ | A |
| Google Analytics, Segment, Mixpanel, Amplitude (relais d'événements du player vers la page hôte) | 🟡 (postMessage ✅) | A |
| Website builder, CMS, Documentation, Forms, Calendar platforms (snippets d'intégration) | ⬜ | A |
| HubSpot, Salesforce, Pipedrive, Zoho, OneTrust, Emailing (Eloqua, Pardot, Marketo), Clearbit, G2, ProductHunt | 🔑 | B (apps OAuth et comptes développeur) |

## API
| Fonction | Statut | Vague |
|---|---|---|
| Cross-frame event | ✅ | |
| Remote control (piloter le player depuis la page hôte) | ⬜ | A |
| Analytics API, Workflow API (clés d'API workspace + Edge Functions) | ⬜ | A |

## Support (🤝 services humains, pas du code)
24/7 support, Live chat, Email support, Slack/Teams channel, Onboarding, CSM, Priority support, Account manager, Team trainings, Private landline, Professional services, Demo creation : 🤝.
À faire en code : **Help documentation** et **Playbook library**, en pages de documentation (vague A).

## Accessibility
| Fonction | Statut |
|---|---|
| Responsive design, Keyboard navigation, WCAG, ARIA | ✅ (audits de la Lead UX), à maintenir |

## Security
| Fonction | Statut |
|---|---|
| GDPR compliant | 🟡 (hébergement UE, pas d'IP stockée, droit à l'effacement des leads ; DPA et registre à rédiger) |
| CCPA | 🟡 |
| SOC2 Type II | 🤝 (audit et certification, pas du code) |
| SSO, SCIM & SAML | 🔑 B |
