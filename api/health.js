export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY),
  });
}
