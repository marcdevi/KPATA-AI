/**
 * Voice API Routes
 * Analyzes voice transcription and generates a structured image generation prompt
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../lib/errors.js';
import { logger } from '../logger.js';

const router = Router();

const analyzeSchema = z.object({
  transcript: z.string().min(1).max(2000),
  hasImage: z.boolean().optional(),
  hasMannequin: z.boolean().optional(),
});

const CATEGORIES = ['clothing', 'beauty', 'accessories', 'shoes', 'jewelry', 'bags'];
const BACKGROUNDS = ['studio_white', 'studio_gray', 'gradient_soft', 'outdoor_street', 'lifestyle_cafe'];

/**
 * POST /voice/analyze
 * Takes a voice transcript and returns a structured prompt + options for image generation
 */
router.post('/analyze', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const { transcript, hasImage, hasMannequin } = analyzeSchema.parse(req.body);

    const apiKey = process.env.OPENROUTER_API_KEY;
    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

    if (!apiKey) {
      res.json({
        prompt: transcript,
        category: 'clothing',
        backgroundStyle: 'studio_white',
        mannequinMode: 'none',
        summary: transcript,
      });
      return;
    }

    logger.info('Analyzing voice transcript', {
      action: 'voice_analyze_start',
      correlation_id: req.correlationId,
      user_id: req.user.id,
      meta: { transcriptLength: transcript.length },
    });

    const systemPrompt = `Tu es un expert en photographie de produits commerciaux et en génération d'images IA.
L'utilisateur va te décrire vocalement ce qu'il veut comme photo de produit.
Tu dois analyser sa demande et retourner un JSON structuré avec:
1. Un prompt professionnel en anglais pour la génération d'image (détaillé, technique, commercial)
2. La catégorie du produit parmi: ${CATEGORIES.join(', ')}
3. Le style de fond parmi: ${BACKGROUNDS.join(', ')}
4. Le mode mannequin: "none" (produit seul) ou "custom" (avec mannequin, seulement si l'utilisateur en parle)
5. Un résumé court en français de ce qui va être généré

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication:
{
  "prompt": "...",
  "category": "...",
  "backgroundStyle": "...",
  "mannequinMode": "none" | "custom",
  "summary": "..."
}`;

    const userMessage = `Voici la description vocale de l'utilisateur: "${transcript}"
${hasImage ? 'L\'utilisateur a déjà uploadé une photo du produit.' : 'Pas de photo de produit uploadée.'}
${hasMannequin ? 'L\'utilisateur a un mannequin personnalisé configuré.' : ''}`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://kpata.ai',
        'X-Title': 'KPATA AI Voice',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let parsed: {
      prompt: string;
      category: string;
      backgroundStyle: string;
      mannequinMode: string;
      summary: string;
    };

    try {
      parsed = JSON.parse(content.trim());
    } catch {
      // Fallback if JSON parsing fails
      parsed = {
        prompt: transcript,
        category: 'clothing',
        backgroundStyle: 'studio_white',
        mannequinMode: 'none',
        summary: transcript,
      };
    }

    // Validate values
    if (!CATEGORIES.includes(parsed.category)) parsed.category = 'clothing';
    if (!BACKGROUNDS.includes(parsed.backgroundStyle)) parsed.backgroundStyle = 'studio_white';
    if (!['none', 'custom'].includes(parsed.mannequinMode)) parsed.mannequinMode = 'none';
    if (!hasMannequin && parsed.mannequinMode === 'custom') parsed.mannequinMode = 'none';

    logger.info('Voice transcript analyzed', {
      action: 'voice_analyze_success',
      correlation_id: req.correlationId,
      user_id: req.user.id,
      meta: { category: parsed.category, backgroundStyle: parsed.backgroundStyle },
    });

    res.json(parsed);
  } catch (error) {
    next(error);
  }
});

export default router;
