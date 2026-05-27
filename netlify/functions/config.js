exports.handler = async () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Clé non configurée' })
    };
  }
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      // Cache 5 minutes
      'Cache-Control': 'private, max-age=300'
    },
    body: JSON.stringify({ k: key })
  };
};
