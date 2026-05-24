// ═══════════════════════════════════════════════════════════════════
// SMART CLIMB — Module d'analyse VIDÉO via Gemini Files API
// Upload la vidéo entière → Gemini la regarde → analyse biomécanique réelle
// ═══════════════════════════════════════════════════════════════════
(function () {
  // ⚠️ Clé API Gemini — DOIT être restreinte par domaine dans Google Cloud Console
  var GEMINI_KEY = window.SMARTCLIMB_GEMINI_KEY || "";
  var GEMINI_MODEL = "gemini-2.0-flash";
  var GEMINI_BASE = "https://generativelanguage.googleapis.com";

  // ── Construit le prompt d'analyse (références pros + structure JSON) ──
  function buildPrompt(profile, historyStr) {
    var p = profile || {};
    return (
      "Tu es un coach d'escalade de haut niveau, expert en biomécanique, pédagogue et bienveillant.\n\n" +
      "Tu reçois une VIDÉO d'une tentative de bloc. Tu peux voir le mouvement réel : vitesse, fluidité, timing, transferts de poids, placements de pieds. Analyse ce que tu OBSERVES réellement dans la vidéo, jamais d'invention.\n\n" +
      "=== RÉFÉRENCES ELITE MONDIALE ===\n" +
      "Adam Ondra (9c): centre de gravité proche du mur en devers, jambe tendue (drop knee), jamais 2 bras fléchis simultanément, anticipe 2-3 mouvements.\n" +
      "Tomoa Narasaki (4x champion bloc): explosivité initiée par les jambes, coordination pied→hanche→épaule→main en 0.3-0.4s.\n" +
      "Janja Garnbret (6x championne): fluidité, aucune pause statique >0.5s, pieds toujours actifs.\n\n" +
      "=== SCORES PAR NIVEAU (sur 100) ===\n" +
      "Débutant 4C-5C: 40-55 | Intermédiaire 6A-6C: 55-70 | Avancé 7A-7C: 70-82 | Expert 8A+: 82-95 | Elite 9A+: 90-100.\n" +
      "Un grimpeur de niveau " + (p.level || "?") + " ne peut PAS dépasser le score typique de son niveau sauf technique exceptionnelle visible.\n\n" +
      "=== PROFIL DU GRIMPEUR ===\n" +
      "Niveau: " + (p.level || "?") + " | Style: " + (p.style || "?") + " | " + (p.height || "?") + "cm / " + (p.weight || "?") + "kg | Force doigts: " + (p.fingerStrength || "?") + "kg | Pmax: " + (p.pmax || "?") + " W/kg.\n" +
      (historyStr ? "Sessions précédentes: " + historyStr + "\n" : "Première session.\n") +
      "\n=== EXERCICES LUDIQUES POSSIBLES ===\n" +
      "« Les muets » (grimper sans bruit), « Le ralenti » (3x plus lent), « Le 4x4 », « Le blocage » (tenir 3s), « Jeu des couleurs ».\n\n" +
      "=== RÈGLES DE RÉDACTION ===\n" +
      "- Décris la session globalement, JAMAIS de référence à des numéros d'images ou de secondes précises.\n" +
      "- Métriques: reflète ce que tu vois RÉELLEMENT bouger. Si une qualité n'est pas observable, donne 50-65, pas 90+.\n" +
      "- Inefficiences: 1-2 points concrets réellement observés.\n" +
      "- Plan d'entraînement: adapté au niveau ET aux défauts vus, au moins 1 exercice ludique, progression réaliste sur 4 semaines.\n\n" +
      "RÉPONDS UNIQUEMENT en JSON valide, sans texte avant/après, sans markdown. Structure exacte :\n" +
      '{"videoObserved":true,"score":<0-100>,"grade":"<A/B/C>","whatISee":"<observation globale fluide>","metrics":{"trajectory":<n>,"explosivity":<n>,"fluidity":<n>,"timing":<n>,"balance":<n>,"efficiency":<n>},"pmaxUsed":<n ou null>,"duration":<n ou null>,"inefficiencies":[{"move":"<moment>","severity":"<high|medium|low>","description":"<1 phrase>","biomechanics":"<1 phrase>","fix":"<1 phrase>"}],"strengths":["<point fort réel>"],"observation":"<2 phrases sur la session>","recommendation":"<1 priorité>","optimalPath":"<1 phrase>","scoreGain":<n>,"historyInsight":"<comparaison ou Première session.>","trainingPlan":{"weeklyGoal":"<objectif>","estimatedProgressionWeeks":<n>,"projectedScore4weeks":<n>,"exercises":[{"name":"<ex>","target":"<cible>","protocol":"<comment>","frequency":"<freq>","rationale":"<pourquoi>","progression":"<progression>"},{"name":"<ex2>","target":"<cible2>","protocol":"<comment>","frequency":"<freq>","rationale":"<pourquoi>","progression":"<progression>"}],"weeklySchedule":[{"day":"<jour>","focus":"<focus>","duration":"<durée>","intensity":"<intensité>"}]}}'
    );
  }

  // ── Étape 1 : Upload de la vidéo via la Files API (resumable) ─────────
  async function uploadVideo(file, onProgress) {
    onProgress && onProgress(10, "Initialisation de l'upload...");

    // Démarre une session d'upload resumable
    var startRes = await fetch(
      GEMINI_BASE + "/upload/v1beta/files?key=" + GEMINI_KEY,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(file.size),
          "X-Goog-Upload-Header-Content-Type": file.type || "video/mp4",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: { display_name: file.name || "climb.mp4" } }),
      }
    );

    if (!startRes.ok) {
      var errTxt = await startRes.text();
      throw new Error("Upload init échoué (" + startRes.status + "): " + errTxt.slice(0, 200));
    }

    var uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) throw new Error("Pas d'URL d'upload renvoyée par Gemini");

    onProgress && onProgress(30, "Envoi de la vidéo...");

    // Envoie les octets et finalise
    var uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(file.size),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: file,
    });

    if (!uploadRes.ok) {
      var e2 = await uploadRes.text();
      throw new Error("Upload échoué (" + uploadRes.status + "): " + e2.slice(0, 200));
    }

    var fileInfo = await uploadRes.json();
    return fileInfo.file; // { uri, name, state, mimeType, ... }
  }

  // ── Étape 2 : Attendre que la vidéo soit "ACTIVE" (Gemini la traite) ──
  async function waitActive(fileName, onProgress) {
    for (var i = 0; i < 30; i++) {
      var res = await fetch(
        GEMINI_BASE + "/v1beta/" + fileName + "?key=" + GEMINI_KEY
      );
      var info = await res.json();
      if (info.state === "ACTIVE") return info;
      if (info.state === "FAILED") throw new Error("Gemini n'a pas pu traiter la vidéo");
      onProgress && onProgress(50 + i, "Traitement de la vidéo par l'IA...");
      await new Promise(function (r) { setTimeout(r, 2000); });
    }
    throw new Error("Délai de traitement vidéo dépassé");
  }

  // ── Étape 3 : Analyse — on passe le file_uri + le prompt ─────────────
  async function analyze(fileUri, mimeType, prompt, onProgress) {
    onProgress && onProgress(82, "Analyse biomécanique...");

    var body = {
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { mimeType: mimeType || "video/mp4", fileUri: fileUri } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 4000, temperature: 0.4 },
    };

    var res = await fetch(
      GEMINI_BASE + "/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + GEMINI_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    var data = await res.json();

    if (data.error) {
      if (data.error.status === "RESOURCE_EXHAUSTED") throw new Error("exceeded_limit");
      throw new Error(data.error.message || "Erreur API Gemini");
    }

    var txt = "";
    try {
      txt = data.candidates[0].content.parts.map(function (p) { return p.text || ""; }).join("");
    } catch (e) {
      throw new Error("Réponse Gemini vide");
    }

    // Nettoyage : enlève les fences markdown éventuels, extrait le JSON
    txt = txt.replace(/```json/gi, "").replace(/```/g, "").trim();
    var match = txt.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Réponse invalide (pas de JSON)");

    return JSON.parse(match[0]);
  }

  // ── Pipeline complet exposé en global ────────────────────────────────
  window.smartClimbAnalyzeVideo = async function (profile, file, history, onProgress) {
    if (!GEMINI_KEY) throw new Error("Clé Gemini non configurée (window.SMARTCLIMB_GEMINI_KEY)");
    if (!file) throw new Error("Aucune vidéo fournie");

    var historyStr = (history || [])
      .filter(function (h) { return h.videoObserved; })
      .slice(-3)
      .map(function (h) {
        var pr = h.params || {};
        return (pr.style || "") + " " + (pr.level || "") + " — score " + h.score;
      })
      .join(" | ");

    var prompt = buildPrompt(profile, historyStr);

    onProgress && onProgress(5, "Préparation...");
    var uploaded = await uploadVideo(file, onProgress);
    var active = await waitActive(uploaded.name, onProgress);
    var result = await analyze(active.uri, active.mimeType, prompt, onProgress);

    onProgress && onProgress(100, "Terminé ✓");
    result.videoObserved = true;
    return result;
  };
})();
