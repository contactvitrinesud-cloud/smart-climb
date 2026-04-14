const https = require('https');

// ── Références bioméchaniques des meilleurs grimpeurs mondiaux ──────────────
const PRO_REFERENCES = `
RÉFÉRENCES BIOMÉCHANIQUES — ELITE MONDIALE (données issues de recherches en sciences du sport)

=== ADAM ONDRA (9C, multiple champion monde) ===
- Centre de gravité : maintenu à max 15cm du mur en dévers, engagement hanche constant
- Pieds : placement précis au millimètre, jambe tendue pour économiser les bras (technique "drop knee")
- Bras : travail en opposition bras tendu / bras fléchi, jamais deux bras fléchis simultanément
- Respiration : expiration forcée à chaque mouvement clé, relâchement conscient entre les prises
- Regard : anticipe la prise suivante avant même d'avoir saisi l'actuelle (2-3 mouvements d'avance)

=== TOMOA NARASAKI (4x champion monde bloc) ===
- Explosivité : ratio force/vitesse exceptionnel — lancer de hanche initié par les jambes, pas les bras
- Coordination : déclenchement pied → hanche → épaule → main en 0.3-0.4s max
- Économie : repos actifs entre les séquences (repositionnement pieds avant de forcer)
- Dévers : utilise le centre de gravité bas comme levier, jambes comme moteur principal

=== JANJA GARNBRET (6x championne monde) ===
- Fluidité : aucune pause statique > 0.5s en position bloquée
- Lecture : analyse complète du bloc avant de démarrer (30-60s minimum)
- Pieds : toujours actifs, ne glissent jamais — repositionnement micro avant chaque effort
- Mental : reset immédiat après une erreur, concentration sur le mouvement suivant uniquement

=== STANDARDS TECHNIQUES PAR NIVEAU ===
6A-6C : Maîtrise des mouvements de base, pieds actifs, centre de gravité proche du mur
7A-7C : Drop knee maîtrisé, dynamisme contrôlé, lecture 5+ mouvements d'avance
8A-8C : Coordination parfaite, économie d'énergie, explosivité ciblée, repos en position
9A+  : Optimisation totale, chaque mouvement calculé, aucun effort superflu

=== DÉFAUTS LES PLUS COURANTS PAR NIVEAU ===
Débutant-intermédiaire : bras trop fléchis (fatigue rapide), pieds passifs, regard au sol
Intermédiaire : centre de gravité trop loin du mur, pause avant les lancers, timing déséquilibré
Avancé : sur-sollicitation des bras sur les mouvements que les jambes pourraient gérer
`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY non configurée dans Netlify' } })
    };
  }

  try {
    const payload = JSON.parse(event.body);

    // Injecter les références pro dans le system prompt
    const systemPrompt = `Tu es un coach d'escalade de haut niveau, pédagogue et bienveillant.

Tu disposes des références bioméchaniques suivantes pour comparer la technique observée aux standards élites :

${PRO_REFERENCES}

TON APPROCHE PÉDAGOGIQUE :
- Commence toujours par valoriser ce qui est bien fait — ça motive et ancre les bons réflexes
- Identifie UN défaut prioritaire par session (pas 5), celui qui aura le plus d'impact
- Explique POURQUOI c'est un défaut (biomécanique simple, pas de jargon inutile)
- Donne une correction concrète et immédiatement applicable au prochain essai
- Compare à des références pros de manière encourageante ("les meilleurs font X, voici comment t'en approcher...")
- Adapte le niveau d'exigence au niveau déclaré du grimpeur
- Termine toujours sur une note positive et motivante

RÈGLES ABSOLUES :
- Ne jamais inventer des défauts que tu ne vois pas dans les images
- Si les images sont floues ou mal cadrées, le dire honnêtement
- Réponses courtes et précises — 1-2 phrases max par champ
- Pas de jargon scientifique excessif — rester accessible`;

    // Construire le body pour l'API Anthropic avec system prompt enrichi
    const anthropicBody = {
      ...payload,
      system: systemPrompt,
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
