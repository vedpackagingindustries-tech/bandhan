const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding AI Provider Configs...');

  const providers = [
    {
      provider: 'ZAI',
      displayName: 'Bandhan AI (Internal)',
      description: 'Internal AI service using z-ai-web-dev-sdk',
      enabled: true,
      config: JSON.stringify({ sdk: 'z-ai-web-dev-sdk' }),
      capabilities: JSON.stringify(['chat', 'vision', 'moderation', 'matching', 'recommendation', 'translation', 'risk-analysis']),
      priority: 10,
      rateLimitRpm: 120,
      costPer1kTok: 0,
    },
    {
      provider: 'OPENAI',
      displayName: 'OpenAI GPT',
      description: 'OpenAI GPT-4/GPT-3.5 for advanced chat and analysis',
      enabled: false,
      config: JSON.stringify({ model: 'gpt-4', baseUrl: 'https://api.openai.com/v1' }),
      capabilities: JSON.stringify(['chat', 'vision', 'moderation', 'recommendation', 'translation', 'risk-analysis']),
      priority: 5,
      rateLimitRpm: 60,
      costPer1kTok: 0.03,
    },
    {
      provider: 'GOOGLE',
      displayName: 'Google Gemini',
      description: 'Google Gemini for multilingual and vision tasks',
      enabled: false,
      config: JSON.stringify({ model: 'gemini-pro' }),
      capabilities: JSON.stringify(['chat', 'vision', 'translation', 'recommendation']),
      priority: 4,
      rateLimitRpm: 60,
      costPer1kTok: 0.025,
    },
    {
      provider: 'ANTHROPIC',
      displayName: 'Anthropic Claude',
      description: 'Anthropic Claude for safe and accurate responses',
      enabled: false,
      config: JSON.stringify({ model: 'claude-3-sonnet' }),
      capabilities: JSON.stringify(['chat', 'moderation', 'recommendation', 'risk-analysis']),
      priority: 3,
      rateLimitRpm: 50,
      costPer1kTok: 0.015,
    },
  ];

  let created = 0;
  for (const p of providers) {
    try {
      await prisma.aIProviderConfig.upsert({
        where: { provider: p.provider },
        update: { displayName: p.displayName, description: p.description, capabilities: p.capabilities, priority: p.priority },
        create: p,
      });
      created++;
      console.log(`  ✓ ${p.provider}`);
    } catch (err) {
      console.error(`  ✗ ${p.provider}: ${err.message}`);
    }
  }

  console.log(`\nAI Providers seeded: ${created}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
