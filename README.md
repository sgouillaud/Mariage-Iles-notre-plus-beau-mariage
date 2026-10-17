# Il.e.s — Notre plus beau voyage

Site d'invitation du mariage de **Cédric & Sébastien** (26 et 27 juin 2027), envoyé par WhatsApp avant le faire-part.

- **`/`** — le site des invités : notre histoire, le programme, les lieux, les infos pratiques et le formulaire de réponse
  (« carte d'embarquement »).
- **`/admin`** — la « tour de contrôle », protégée par mot de passe : toutes les réponses, les chiffres clés,
  les exports Excel, la modification des infos pratiques et la sauvegarde.

Même architecture que la roue SEFE : serveur Node.js (Express) + base SQLite, hébergé sur **Railway** depuis **GitHub**.

---

## 1. Contenu du projet

```
mariage-iles/
├── server.js             serveur web + API publique et admin
├── src/
│   ├── db.js             base SQLite (réponses + infos pratiques)
│   ├── rsvp.js           vérification des réponses du formulaire
│   └── auth.js           mot de passe admin, session signée, anti-force brute
├── public/
│   ├── index.html        page des invités
│   ├── site.css          styles et animations
│   ├── site.js           formulaire, tableau des départs, apparitions au défilement
│   ├── intro.js          animation d'ouverture « notre itinéraire »
│   ├── admin.html/.css/.js  tour de contrôle
│   ├── logo.webp         logo Il.e.s
│   └── apercu-whatsapp.jpg  image affichée dans WhatsApp quand on partage le lien
├── test/                 tests automatiques (npm test)
├── Dockerfile            construction de l'application
├── railway.json          configuration Railway
└── .env.example          modèle des variables (à ne jamais publier rempli)
```

## 2. Ce que fait le site

**Pour les invités**
- Ouverture « notre itinéraire » : bouton « Embarquer » (qui autorise le son), puis un petit avion relie nos îles jusqu'à Cloyes (vol de 3,5 s, 2,5 s pour lire l'arrivée ; un toucher la fait passer). Le logo se pose ensuite comme un tampon de passeport.
  Jouée une fois par visite, et désactivée automatiquement si le téléphone demande moins d'animations.
- Tableau des départs à palettes (style aéroport), précédé d'un carillon « ding ding dong » et accompagné du cliquetis des palettes, qui défile jusqu'au nombre de jours restants ; les sections apparaissent au fil du défilement.
- Formulaire : nom, prénom, email, téléphone, présence (oui / non), moments (mairie, cérémonie & cocktail,
  dîner, brunch), hébergement (logé sur place ou par ses propres moyens), accompagnant(e), enfants (nom, prénom, âge),
  allergies et régime, petit mot.
- **Un invité peut corriger sa réponse** : s'il renvoie le formulaire avec le même email et le même prénom,
  sa réponse est mise à jour (pas de doublon). Un couple qui répond chacun de son côté avec le même email
  mais des prénoms différents apparaît en deux réponses.

**Pour vous (`/admin`)**
- Chiffres clés : personnes confirmées, réponses, oui / non, personnes à loger,
  enfants, allergies, et nombre de personnes par moment (mairie, cérémonie, dîner, brunch).
- Recherche et filtres (Oui, Non, Logés, Allergies), suppression d'une réponse.
- **Infos pratiques** : ajoutez, modifiez, réordonnez les infos (parking, train, dress code, liste de mariage…).
  Cochez « À venir » pour une info pas encore prête. Le site est mis à jour immédiatement, sans redéploiement.
- Exports CSV pour Excel : toutes les réponses, ou la liste des enfants (pour le traiteur).
- Sauvegarde complète de la base (.db).

## 3. Essai en local (facultatif)

```bash
npm install
cp .env.example .env        # puis modifiez ADMIN_PASSWORD et SESSION_SECRET dans .env
npm run dev
```
Ouvrez http://localhost:3000 (site) et http://localhost:3000/admin (tour de contrôle). Tests : `npm test`.

## 4. Mise en ligne sur Railway

Mêmes étapes que pour la roue.

### Étape 1 — Mettre le code sur GitHub
1. Sur https://github.com : **New repository** → nom `mariage-iles` → **Private** → *Create*.
2. Ajoutez les fichiers en respectant les dossiers (**Add file → Upload files**, sans `node_modules`, `data`, `.env`).
3. Ne mettez **jamais** de fichier `.env` ni de mot de passe dans GitHub.

### Étape 2 — Créer le projet Railway
1. https://railway.com → **New Project → Deploy from GitHub repo** → choisissez `mariage-iles`.
2. Le premier déploiement échoue tant que les variables ne sont pas renseignées : c'est normal.

### Étape 3 — Ajouter le volume (indispensable pour garder les réponses)
Dans le projet : **+ / Create → Volume**, rattaché au service `mariage-iles`, **chemin de montage `/data`**.

### Étape 4 — Renseigner les variables
Service → onglet **Variables** :

| Variable | Valeur |
|---|---|
| `ADMIN_PASSWORD` | mot de passe long (16 caractères ou plus), à partager avec Cédric |
| `SESSION_SECRET` | chaîne aléatoire de 64 caractères |
| `NODE_ENV` | `production` |
| `DB_PATH` | `/data/mariage.db` |

Railway fournit `PORT` automatiquement.

### Étape 5 — Obtenir le lien
Service → **Settings → Networking → Generate Domain**. Vous pouvez choisir un nom lisible, par exemple
`iles-cedric-sebastien.up.railway.app`. Un nom de domaine personnalisé (ex. `cedric-et-sebastien.fr`) peut
aussi être branché dans **Settings → Networking → Custom Domain**.

### Étape 6 — Vérifier avant d'envoyer le lien
1. Ouvrez le site sur votre téléphone, envoyez une réponse de test.
2. Ouvrez `/admin` : la réponse apparaît. Supprimez-la.
3. Redéployez une fois (**Deployments → Redeploy**) et vérifiez que les infos pratiques modifiées sont toujours là
   (preuve que le volume fonctionne).
4. Envoyez-vous le lien sur WhatsApp : l'aperçu doit montrer le logo. Si WhatsApp a gardé un ancien aperçu
   en mémoire, ajoutez `?v=2` à la fin du lien.

### Important
- Gardez **une seule instance** (1 replica) : la base est un fichier sur le volume.
- Chaque modification poussée sur GitHub redéploie automatiquement le site. Les réponses et les infos pratiques,
  elles, sont dans la base et ne bougent pas.
- Faites une sauvegarde (`/admin` → Exports → Sauvegarde) de temps en temps, surtout après une vague de réponses.

## 5. Modifier le contenu

| Je veux changer… | Où |
|---|---|
| Les infos pratiques, les trajets dépliables (voiture, train) et leurs liens | `/admin` → Infos pratiques (sans toucher au code) |
| Les horaires du programme, notre histoire, les textes | `public/index.html` |
| Les couleurs | `public/site.css`, variables en haut du fichier |
| Le logo | remplacez `public/logo.webp` (et `public/apercu-whatsapp.jpg` pour WhatsApp) |

## 6. Données personnelles
Le site collecte noms, emails, téléphones, âges des enfants et allergies de vos invités. Elles ne servent qu'à
l'organisation du mariage, sont visibles uniquement avec le mot de passe admin, et peuvent être supprimées
une par une depuis `/admin`. Pensez à supprimer le projet Railway (ou à vider la base) une fois le mariage passé.
