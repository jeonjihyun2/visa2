// Vercel Serverless Function - AI Visa Analysis API
// API Key stored in environment variable, not in code

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { score, answers, ageGroup } = req.body;

  if (!score || !answers) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Get API Key from environment variable
  const apiKey = process.env.FREEMODEL_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('API Key not configured');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  const level = score >= 70 ? '低风险' : score >= 50 ? '中风险' : '高风险';

  const prompt = `你是一位资深美国签证顾问，拥有10年以上签证申请指导经验。请根据以下申请人的测评结果，生成一份专业的AI深度分析报告。

【测评结果】
- 通过率评分：${score}%
- 风险等级：${level}
- 申请人类型：${ageGroup === 'student' ? '学生' : '在职人士'}

【详细回答】
${answers}

请生成以下内容的JSON格式报告（不要包含markdown代码块标记）：
{
  "overall": "总体评估：3-4句话，分析整体通过率和关键影响因素",
  "strengths": ["优势1", "优势2", "优势3", "优势4"],
  "risks": ["风险1", "风险2", "风险3", "风险4"],
  "suggestions": ["建议1", "建议2", "建议3", "建议4", "建议5", "建议6"]
}

要求：
1. 总体评估要具体、专业，结合申请人的实际情况
2. 优势和风险要基于提供的回答内容分析得出
3. 建议要可操作、有针对性
4. 全部使用中文回复`;

  try {
    // Call FreeModel API (OpenAI-compatible format)
    const response = await fetch('https://api.freemodel.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '你是一位专业的美国签证顾问，擅长分析签证申请条件并给出专业建议。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI API error:', error);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const aiContent = data.choices[0].message.content;
    
    // Parse JSON response
    let result;
    try {
      // Try to extract JSON if wrapped in markdown
      const jsonMatch = aiContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                        aiContent.match(/```\n?([\s\S]*?)\n?```/) ||
                        [null, aiContent];
      result = JSON.parse(jsonMatch[1] || aiContent);
    } catch (e) {
      console.error('JSON parse error:', e);
      // Fallback: return raw content
      result = {
        overall: aiContent.substring(0, 200) + '...',
        strengths: ['AI分析完成'],
        risks: ['请查看详细分析'],
        suggestions: ['建议咨询专业顾问']
      };
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
