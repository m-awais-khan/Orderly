import axios from 'axios';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Analyze user's watchlist and prepare a summary for AI
 * @param {Object} lists - User's watchlist data
 * @returns {Object} Watchlist summary with completed, watching, dropped items
 */
export const analyzeWatchlist = (lists) => {
    const analysis = {
        completed: [],
        watching: [],
        dropped: [],
        not_interested: [],
        scores: {}
    };

    // Flatten all lists and categorize by status
    Object.values(lists).flat().forEach(item => {
        if (!item.text) return; // Skip items without titles

        const entry = {
            title: item.text,
            type: item.media_type || 'unknown',
            score: item.score || null
        };

        // Categorize by status
        if (item.status === 'completed') {
            analysis.completed.push(entry);
            if (entry.score) {
                analysis.scores[entry.title] = entry.score;
            }
        } else if (item.status === 'watching') {
            analysis.watching.push(entry);
        } else if (item.status === 'dropped') {
            analysis.dropped.push(entry);
        } else if (item.status === 'not_interested') {
            analysis.not_interested.push(entry);
        }
    });

    return analysis;
};

/**
 * Get AI recommendations from Google Gemini
 * @param {Object} watchlistSummary - Analyzed watchlist data
 * @returns {Promise<Object>} AI recommendations with categories
 */
export const getRecommendations = async (watchlistSummary) => {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured in environment variables');
    }

    // Build the prompt
    const prompt = buildPrompt(watchlistSummary);

    try {
        const response = await axios.post(
            `${GEMINI_API_ENDPOINT}?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 16384,
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract and parse the AI response
        const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!aiText) {
            throw new Error('Invalid response from Gemini API');
        }

        return parseAIResponse(aiText);
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw new Error(error.response?.data?.error?.message || 'Failed to get AI recommendations');
    }
};

/**
 * Build the prompt for Gemini AI
 * @param {Object} summary - Watchlist summary
 * @returns {string} Formatted prompt
 */
const buildPrompt = (summary) => {
    const completedTitles = summary.completed.map(item =>
        `${item.title} (${item.type}${item.score ? `, rated ${item.score}/10` : ''})`
    ).join(', ');

    const watchingTitles = summary.watching.map(item =>
        `${item.title} (${item.type})`
    ).join(', ');

    const droppedTitles = summary.dropped.map(item =>
        `${item.title} (${item.type}${item.score ? `, rated ${item.score}/10` : ''})`
    ).join(', ');

    const notInterestedTitles = summary.not_interested.map(item =>
        `${item.title} (${item.type}${item.score ? `, rated ${item.score}/10` : ''})`
    ).join(', ');

    return `You are a movie and TV show recommendation expert. Analyze this user's watchlist and suggest personalized recommendations.

WATCHLIST ANALYSIS:
Completed (${summary.completed.length} items): ${completedTitles || 'None'}
Currently Watching (${summary.watching.length} items): ${watchingTitles || 'None'}
Dropped (${summary.dropped.length} items): ${droppedTitles || 'None'}
Not Interested (${summary.not_interested.length} items): ${notInterestedTitles || 'None'}

TASK:
1. Identify 3-5 most relevant genre + media type combinations based on the user's preferences
2. For each category, suggest exactly 15 titles (mix of movies and TV shows)
3. Avoid suggesting anything already in their watchlist
4. Consider their ratings - prioritize genres/types they rated highly
5. Be diverse - include popular, hidden gems, and recent releases

IMPORTANT: Respond ONLY with valid JSON (no markdown, no code blocks). Format:
{
  "categories": [
    {
      "name": "Genre MediaType" (e.g., "Action Movies", "Comedy TV Shows"),
      "items": [
        {
          "title": "Title",
          "year": 2023,
          "type": "movie" or "tv"
        }
      ]
    }
  ]
}`;
};

/**
 * Parse AI response and extract recommendations
 * @param {string} aiText - Raw AI response
 * @returns {Object} Parsed recommendations
 */
const parseAIResponse = (aiText) => {
    try {
        // Remove markdown code blocks if present
        let cleanedText = aiText.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
        }

        // Try to extract JSON object if there's extra text
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanedText = jsonMatch[0];
        }

        const parsed = JSON.parse(cleanedText);

        // Validate structure
        if (!parsed.categories || !Array.isArray(parsed.categories)) {
            throw new Error('Invalid recommendations format');
        }

        // Ensure we have 3-5 categories
        parsed.categories = parsed.categories.slice(0, 7);

        // Validate each category has items array
        parsed.categories = parsed.categories.map(cat => ({
            ...cat,
            items: (cat.items || []).slice(0, 20) // Cap at 20 items
        })).filter(cat => cat.items.length > 0); // Remove empty categories

        return parsed;
    } catch (error) {
        console.error('Failed to parse AI response:', aiText);
        console.error('Parse error:', error);
        throw new Error('Failed to parse AI recommendations');
    }
};
/**
 * Get a Daily Challenge recommendation (Single Movie)
 * @param {Object} watchlistSummary - Analyzed watchlist data
 * @returns {Promise<Object>} Single movie recommendation
 */
// Helper: Get random N items from array
const getRandomSamples = (array, n) => {
    if (!array) return [];
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, n);
};

export const getDailyChallenge = async (watchlistSummary) => {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const MAX_RETRIES = 3;
    let attempts = 0;

    // Normalize comparison to avoid duplicates
    const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const completedSet = new Set((watchlistSummary.completed || []).map(i => normalize(i.title)));

    let lastError = null;

    while (attempts < MAX_RETRIES) {
        attempts++;

        // 1. Pick 10 random items from completed list
        const randomCompleted = getRandomSamples(watchlistSummary.completed, 10);

        // 2. Build prompt with these specific random items
        const prompt = buildDailyChallengePrompt(randomCompleted);

        try {
            const response = await axios.post(
                `${GEMINI_API_ENDPOINT}?key=${GEMINI_API_KEY}`,
                {
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7, // Higher temp for variety since we are checking duplicates
                        maxOutputTokens: 16384,
                    }
                },
                { headers: { 'Content-Type': 'application/json' } }
            );

            const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiText) throw new Error('Invalid response from Gemini API');

            const result = parseDailyChallengeResponse(aiText);

            // 3. Check for duplicates
            if (!completedSet.has(normalize(result.title))) {
                return result; // Success: Unique recommendation
            }

            console.warn(`[DailyChallenge] Generated duplicate: "${result.title}". Retrying (${attempts}/${MAX_RETRIES})...`);

        } catch (error) {
            console.error('[DailyChallenge] Error:', error);
            lastError = error;
        }
    }

    throw lastError || new Error('Failed to generate a unique Daily Challenge after retries.');
};

/**
 * Build prompt for Daily Challenge
 */
/**
 * Build prompt for Daily Challenge
 * @param {Array} completedItems - Array of 10 random completed items
 */
const buildDailyChallengePrompt = (completedItems) => {
    const completedSample = (completedItems || []).map(i => i.title).join(', ');

    return `You are a movie curator giving a "Daily Movie Challenge".
User's taste based on recent watches: ${completedSample || 'General popular movies'}.

TASK:
Suggest EXACTLY ONE (1) movie that is a "Must Watch" challenge for today.
- It should be a masterpiece, a cult classic, or a hidden gem that matches their taste.
- Do NOT suggest generic blockbusters unless they are absolute cinema classics.
- Do NOT suggest anything they have already watched.

IMPORTANT:
- Respond ONLY in valid JSON.
- Do NOT use markdown code blocks.
- Do NOT use double quotes (") inside the content strings. Use single quotes (') instead.
- RETURN A SINGLE JSON OBJECT delimited by curly braces { }. DO NOT return a list [ ].
- Keep the "reason" short (under 20 words).

FORMAT:
        {
            "title": "Movie Title",
            "year": 2000,
            "type": "movie",
            "reason": "Short reason why."
        }
IMPORTANT: Return ONLY valid JSON. Use double quotes for all keys and string values. Do not use single quotes for JSON strings.`;
};

/**
 * Parse Daily Challenge Response
 */
const parseDailyChallengeResponse = (aiText) => {
    try {
        let jsonString;
        const firstBrace = aiText.indexOf('{');
        let lastBrace = aiText.lastIndexOf('}');

        // Handle Truncated JSON (Attempt Repair)
        if (firstBrace !== -1 && lastBrace === -1) {
            console.warn('Warning: JSON seems truncated. Attempting repair...');
            // Most common truncation is inside the last string or just missing the closing brace
            const trimmed = aiText.trim();
            // If it ends with a quote, just add }
            if (trimmed.endsWith('"') || trimmed.endsWith("'")) {
                jsonString = trimmed.substring(firstBrace) + '}';
            } else {
                // assume it ended inside a string, close quote and brace
                jsonString = trimmed.substring(firstBrace) + '"}';
            }
        }
        else if (firstBrace !== -1 && lastBrace !== -1) {
            // Standard object found
            jsonString = aiText.substring(firstBrace, lastBrace + 1);
        }
        else {
            // Fallback: Check for malformed [ ... ] array
            const firstBracket = aiText.indexOf('[');
            const lastBracket = aiText.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1) {
                const content = aiText.substring(firstBracket + 1, lastBracket).trim();
                jsonString = `{${content}}`;
            }
        }

        if (!jsonString) {
            throw new Error('No valid JSON object character found');
        }

        // Sanitization: Replace single quotes with double quotes if they look like JSON keys/values
        // This is a naive fix for the specific issue of LLMs returning 'key': 'value'
        // We only target keys and values wrapped in single quotes that are likely safely replaceable
        let sanitized = jsonString;

        // If parsing fails initially, try to fix single quotes
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            // Replace 'key': with "key":
            sanitized = sanitized.replace(/'([a-zA-Z0-9_]+)':/g, '"$1":');
            // Replace : 'value' with : "value" (careful with internal quotes)
            // A safer approach for values is hard with regex. 
            // Only try if the error likely indicates single quotes.

            // Try another approach: use Function constructor (dangerous but effective for loose JS objects) if clearly isolated
            // But let's stick to regex for common single quote keys first.

            // For simple string values: : '...' -> : "..."
            sanitized = sanitized.replace(/: '([^']*)'/g, ': "$1"');

            // Retry parse
            const parsed = JSON.parse(sanitized);
            return parsed;
        }

        if (!parsed.title || !parsed.year) {
            throw new Error('Invalid challenge format: missing title or year');
        }

        return parsed;
    } catch (error) {
        console.error('Failed to parse daily challenge:', error);
        console.error('Raw AI Text:', aiText);
        throw new Error('Failed to parse daily challenge');
    }
};
