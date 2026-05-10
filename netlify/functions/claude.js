const https = require('https');
const MODEL_OPUS    = 'claude-opus-4-7';
const MODEL_SONNET  = 'claude-sonnet-4-6';

function pickModel(mode) {
  switch (mode) {
    case 'route_reading':
    case 'block_generation':    // ← prêt pour la prochaine feature
      return MODEL_OPUS;
    case 'coaching':
    default:
      return MODEL_SONNET;
  }
}
 
const PRO_REFERENCES = `
REFERENCES BIOMECANIQUES — ELITE MONDIALE
 
=== ADAM ONDRA (9C) ===
- Centre de gravite max 15cm du mur en devers
- Pieds: placement precis, jambe tendue (drop knee)
- Bras: opposition tendu/flechi, jamais 2 bras flechis simultanement
- Regard: anticipe 2-3 mouvements d avance
 
=== TOMOA NARASAKI (4x champion monde bloc) ===
- Explosivite: lancer de hanche initie par les jambes
- Coordination: pied -> hanche -> epaule -> main en 0.3-0.4s
 
=== JANJA GARNBRET (6x championne monde) ===
- Fluidite: aucune pause statique > 0.5s en bloque
- Pieds: toujours actifs, repositionnement micro
 
=== STANDARDS PAR NIVEAU ===
6A-6C: Pieds actifs, centre de gravite proche du mur
7A-7C: Drop knee, dynamisme controle, lecture 5+ mouvements
8A+: Economie totale, explosivite ciblee, repos en position
 
=== SCORES TYPIQUES PAR NIVEAU (sur 100, base sur references pros) ===
Debutant (4C-5C): score moyen 40-55
Intermediaire (6A-6C): score moyen 55-70
Avance (7A-7C): score moyen 70-82
Expert (8A+): score moyen 82-95
Elite (9A+): score moyen 90-100 (Ondra/Garnbret/Narasaki = reference 95-100)
`;
 
const TRAINING_PHILOSOPHY = `
PHILOSOPHIE D ENTRAINEMENT — PRATICABLE ET LUDIQUE
 
Chaque exercice doit etre:
1. Faisable en salle de bloc classique sans materiel special
2. Avec objectif clair et mesurable
3. Progressif sur 4 semaines
4. Garder le plaisir (jeux, defis, circuits)
5. Cibler UN seul defaut a la fois
 
FORMATS APPRECIES:
- "Les muets": grimper sans bruit avec les pieds
- "Le ralenti": grimper 3x plus lentement
- "Le 4x4": 4 blocs sans pause repete 4 fois
- "Le blocage": tenir chaque position 3s
- "Jeu des couleurs": une seule couleur de prises
`;
 
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
// AVANT
model: payload.model || 'claude-sonnet-4-20250514'

// APRÈS
const selectedModel = payload.model || pickModel(mode);
// ...
model: selectedModel
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      },
      body: '',
    };
  }
'X-Smart-Climb-Model': selectedModel
max_tokens: payload.max_tokens || (mode === 'route_reading' ? 4500 : 2500)

 
  // ── DELETE: Suppression d'une analyse dans Supabase ───────────────────
  if (event.httpMethod === 'DELETE') {
    try {
      const { analysisId, profileId } = JSON.parse(event.body || '{}');
      const supaUrl = process.env.SUPABASE_URL;
      const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      if (!supaUrl || !supaKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Supabase non configure' }) };
      }
      const url = supaUrl + '/rest/v1/analyses?profile_id=eq.' + encodeURIComponent(profileId) + (analysisId ? '&id=eq.' + encodeURIComponent(analysisId) : '');
      const res = await new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
          hostname: u.hostname, path: u.pathname + u.search, method: 'DELETE',
          headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey, 'Prefer': 'return=minimal' }
        }, r => { let d=''; r.on('data', c=>d+=c); r.on('end', ()=>resolve({status:r.statusCode,body:d})); });
        req.on('error', reject); req.end();
      });
      return { statusCode: 200, headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' }, body: JSON.stringify({ ok: res.status < 400, status: res.status }) };
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }
 
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
 
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY non configuree' } }) };
  }
 
  try {
    const payload = JSON.parse(event.body);
    const mode = payload.mode || 'coaching';
    let systemPrompt;
 
    if (mode === 'route_reading') {
      systemPrompt = `Tu es un coach d escalade expert en lecture de voie.
 
Tu recois une photo d un mur de bloc. Tu dois identifier les prises visibles et leurs positions PRECISES.
 
IMPORTANT — coordonnees:
- x=0 bord gauche, x=100 bord droit
- y=0 haut de l image, y=100 bas
 
OBJECTIFS:
- LOLOTTE: prises forcant placement de hanche, genou interieur
- TECHNIQUE: prises demandant precision et equilibre
- FORCE: prises petites ou loin, explosion ou maintien
- DALLE: prises hautes, friction, transfert poids sur pieds
- DEVERS: prises sous plafond, gainage et pieds actifs
- COORDINATION: enchainement de mouvements dynamiques
 
ESTIMATION DU NIVEAU DU BLOC:
Tu DOIS aussi estimer le niveau de difficulte du bloc (echelle francaise: 4A, 4B, 4C, 5A, 5B, 5C, 6A, 6A+, 6B, 6B+, 6C, 6C+, 7A, 7A+, 7B, 7B+, 7C, 7C+, 8A, 8A+).
Critere: taille des prises (gros bacs=facile, petites reglettes/bossettes=dur), inclinaison du mur, espacement des prises, complexite de l enchainement.
 
Tu DOIS repondre UNIQUEMENT avec du JSON valide, sans texte avant ou apres, sans markdown.
Format exact:
{"objective":"<objectif>","wallType":"<type de mur>","estimatedLevel":"<niveau ex: 6B>","levelReason":"<courte explication du niveau>","holds":[{"id":1,"x":<0-100>,"y":<0-100>,"type":"<bac|reglette|bossette|volume|plot>","color":"<couleur>","priority":"<high|medium|low>","relevance":"<pertinence>","usage":"<utilisation>"}],"suggestedSequence":"<enchainement etape par etape>","keyMove":"<mouvement cle>","tip":"<conseil>","progression":"<comment progresser>"}`;
    } else {
      systemPrompt = `Tu es un coach d escalade de haut niveau, pedagogue et bienveillant.
 
${PRO_REFERENCES}
 
${TRAINING_PHILOSOPHY}
 
REGLES STRICTES SUR LES SCORES ET POURCENTAGES:
- Les scores DOIVENT etre coherents avec le niveau declare du grimpeur (cf SCORES TYPIQUES PAR NIVEAU)
- Compare aux references pros: un grimpeur 6A NE PEUT PAS avoir un score >82 (reserve aux 8A+)
- Les metriques (trajectory, explosivity, fluidity, timing, balance, efficiency) doivent refleter ce que tu VOIS reellement
- Si tu ne vois pas clairement une qualite (ex: timing si pas de mouvement explosif visible), donne un score moyen 50-65 pas 90+
- Ne jamais donner de scores >90 sauf si la technique observee est clairement de niveau elite mondial
 
POUR LES INEFFICIENCES:
- Identifier 1-2 points concrets reellement observables sur les images
- Comparer aux references pros UNIQUEMENT quand pertinent et constate
 
POUR LES STRENGTHS:
- Citer ce qui est reellement bien fait, base sur les images
- Pas de strength generique non observee
 
POUR LE PLAN D ENTRAINEMENT:
- Adapte au niveau declare ET aux defauts vus
- Au moins 1 exercice ludique
- Progression realiste sur 4 semaines
 
REPONDS UNIQUEMENT en JSON valide, sans texte avant ou apres.`;
    }
 
    const anthropicBody = {
      model: payload.model || 'claude-sonnet-4-20250514',
      max_tokens: payload.max_tokens || 2500,
      system: systemPrompt,
      messages: payload.messages,
    };
 
    const bodyStr = JSON.stringify(anthropicBody);
 
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
 
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: result,
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: e.message } }),
    };
  }
};
 
