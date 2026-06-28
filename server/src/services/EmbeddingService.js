const axios = require('axios');

// MongoDB Atlas hosts Voyage AI models at ai.mongodb.com.
// Atlas Model API keys (created in Atlas UI) must use this endpoint —
// they are rejected by the original api.voyageai.com endpoint.
const VOYAGE_API_URL = 'https://ai.mongodb.com/v1/embeddings';

/**
 * Generate embedding vector for a single text using Voyage-4
 * @param {string} text
 * @returns {Promise<number[]>} 1024-dim vector
 */
async function embed(text) {
  const response = await axios.post(
    VOYAGE_API_URL,
    {
      input: [text],
      model: process.env.VOYAGE_MODEL || 'voyage-4',
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
  return response.data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts) {
  const response = await axios.post(
    VOYAGE_API_URL,
    {
      input: texts,
      model: process.env.VOYAGE_MODEL || 'voyage-4',
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
  return response.data.data.map((d) => d.embedding);
}

module.exports = { embed, embedBatch };
