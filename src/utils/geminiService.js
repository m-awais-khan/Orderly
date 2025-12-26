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
            if (entry.score) {
                analysis.scores[entry.title] = entry.score;
            }
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
                    maxOutputTokens: 8192,
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

    return `You are a movie and TV show recommendation expert. Analyze this user's watchlist and suggest personalized recommendations.

WATCHLIST ANALYSIS:
Completed (${summary.completed.length} items): ${completedTitles || 'None'}
Currently Watching (${summary.watching.length} items): ${watchingTitles || 'None'}
Dropped (${summary.dropped.length} items): ${droppedTitles || 'None'}

TASK:
1. Identify 3-5 most relevant genre + media type combinations based on the user's preferences
2. For each category, suggest exactly 10 titles (mix of movies and TV shows)
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
        parsed.categories = parsed.categories.slice(0, 5);

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
