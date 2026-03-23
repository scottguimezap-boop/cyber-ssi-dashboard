const functions = require("firebase-functions");
const OpenAI = require("openai");

// ============================
// SENDGRID EMAIL
// ============================
const sgMail = require("@sendgrid/mail");
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
sgMail.setApiKey(SENDGRID_API_KEY);

exports.sendEmail = functions.https.onCall(async (data, context) => {
  const { to, subject, message } = data;

  if (!to || !subject || !message) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Les champs to, subject et message sont requis."
    );
  }

  const email = {
    to: to,
    from: "scottguimezap@gmail.com",
    subject: subject,
    text: message,
    html: `<p>${message}</p>`,
  };

  try {
    await sgMail.send(email);
    return { success: true };
  } catch (error) {
    console.error("Erreur SendGrid:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Erreur lors de l'envoi de l'email."
    );
  }
});

// ============================
// OPENAI ChatGPT — Analyse fournisseur
// ============================
exports.askClaude = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Vous devez être connecté."
    );
  }

  const { prompt, fournisseurData } = data;

  if (!prompt) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Le champ prompt est requis."
    );
  }

  // La clé API est stockée dans les secrets Firebase
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Clé API OpenAI non configurée."
    );
  }

  const client = new OpenAI({ apiKey });

  // Construire le contexte avec les données fournisseur si disponibles
  const systemPrompt = `Tu es un expert en cybersécurité et gestion des risques tiers (TPRM).
Tu analyses les fournisseurs pour une plateforme de sécurité appelée CYBER-SSI.
Réponds toujours en français. Sois concis, précis et actionnable.
Structure tes réponses avec des titres et des listes quand c'est pertinent.`;

  let userMessage = prompt;
  if (fournisseurData) {
    userMessage = `Contexte fournisseur :
- Nom : ${fournisseurData.nomFournisseur || "N/A"}
- Type : ${fournisseurData.typePrestataire || "N/A"}
- Confiance : ${fournisseurData.niveauConfiance || "N/A"}/5
- Statut : ${fournisseurData.status || "N/A"}
- RGPD : ${fournisseurData.conformiteRGPD || "N/A"}
- Hébergement : ${fournisseurData.hebergementDonnees || "N/A"}
- Certifications : ${fournisseurData.certificationISO || "N/A"}
- Score de risque : ${fournisseurData.scoreRisque || "N/A"}%

Question : ${prompt}`;
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const text = response.choices[0].message.content;

    return {
      success: true,
      response: text,
      usage: {
        input_tokens: response.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens,
      },
    };
  } catch (error) {
    console.error("Erreur OpenAI API:", error.message);
    throw new functions.https.HttpsError(
      "internal",
      "Erreur lors de l'appel à ChatGPT."
    );
  }
});
