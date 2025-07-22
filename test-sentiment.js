// Quick test script to verify sentiment classification works
// Run with: node test-sentiment.js

// Test the core sentiment logic
function classifyBasicSentiment(text) {
  const lowerText = text.toLowerCase();
  
  const proKeywords = [
    'support', 'approve', 'yes', 'help', 'relief', 'benefit',
    'improve', 'reform', 'forward', 'progress', 'agree'
  ];
  
  const antiKeywords = [
    'oppose', 'against', 'no', 'stop', 'prevent', 'reject',
    'wrong', 'bad', 'waste', 'unfair', 'disagree'
  ];
  
  const intensityKeywords = [
    'very', 'extremely', 'really', 'strongly', 'completely',
    'absolutely', 'definitely', 'urgent', 'crisis', '!'
  ];
  
  const proMatches = proKeywords.filter(keyword => lowerText.includes(keyword));
  const antiMatches = antiKeywords.filter(keyword => lowerText.includes(keyword));
  const intensityMatches = intensityKeywords.filter(keyword => lowerText.includes(keyword));
  
  let sentiment;
  let confidence;
  const keywords_found = [...proMatches, ...antiMatches];
  
  if (proMatches.length > antiMatches.length) {
    sentiment = 'pro';
    confidence = Math.min(0.9, 0.6 + (proMatches.length * 0.1));
  } else if (antiMatches.length > proMatches.length) {
    sentiment = 'anti';
    confidence = Math.min(0.9, 0.6 + (antiMatches.length * 0.1));
  } else {
    sentiment = 'neutral';
    confidence = keywords_found.length > 0 ? 0.6 : 0.3;
  }
  
  const baseIntensity = Math.min(1.0, keywords_found.length * 0.2);
  const intensityBoost = Math.min(0.4, intensityMatches.length * 0.15);
  const intensity = Math.min(1.0, baseIntensity + intensityBoost);
  
  return {
    sentiment,
    confidence,
    intensity,
    keywords_found
  };
}

// Test messages from the mathematical pipeline example
const testMessages = [
  "Student loans crushing families, support forgiveness!",
  "Oppose loan forgiveness, people should pay debts",
  "Lower interest rates on student loans",
  "Cancel student debt completely!",
  "Pause loan payments during hardship"
];

console.log('🧪 Testing Basic Sentiment Classifier...\n');

testMessages.forEach((message, index) => {
  const result = classifyBasicSentiment(message);
  console.log(`Message ${index + 1}: "${message}"`);
  console.log(`  Sentiment: ${result.sentiment} (confidence: ${result.confidence.toFixed(2)})`);
  console.log(`  Intensity: ${result.intensity.toFixed(2)}`);
  console.log(`  Keywords: ${result.keywords_found.join(', ')}\n`);
});

console.log('✅ Basic sentiment tests completed!');