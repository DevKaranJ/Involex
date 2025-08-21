import { openaiService, EmailAnalysisRequest } from '../services/openaiService';
import { logger } from '../utils/logger';

// Test script for OpenAI integration
async function testOpenAIIntegration() {
  console.log('🧪 Testing OpenAI Integration...\n');

  // Check if service is configured
  console.log('1. Service Configuration Check:');
  const isAvailable = openaiService.isServiceAvailable();
  console.log(`   - Service Available: ${isAvailable}`);

  if (!isAvailable) {
    console.log('   ❌ OpenAI service not configured. Set OPENAI_API_KEY environment variable.');
    return;
  }

  // Test connection
  console.log('\n2. Connection Test:');
  try {
    const canConnect = await openaiService.testConnection();
    console.log(`   - Connection: ${canConnect ? '✅ Success' : '❌ Failed'}`);
    
    if (!canConnect) {
      console.log('   ❌ Cannot connect to OpenAI. Check API key and network connection.');
      return;
    }
  } catch (error) {
    console.log('   ❌ Connection test failed:', error);
    return;
  }

  // Test email analysis
  console.log('\n3. Email Analysis Test:');
  const testEmail: EmailAnalysisRequest = {
    subject: 'Contract Review Request - NDA for Tech Partnership',
    content: `Hi John,

Please review the attached NDA for our upcoming partnership with TechCorp. 
This is time-sensitive as they need it back by Friday for their board meeting.

Key points to focus on:
- Intellectual property clauses (sections 3-4)
- Term length and termination provisions
- Mutual vs unilateral obligations

The partnership is worth approximately $2M annually, so we want to ensure 
our interests are protected while not being overly restrictive.

Let me know if you have any questions or concerns.

Best regards,
Sarah Johnson
Business Development`,
    sender: 'sarah.johnson@clientfirm.com',
    recipients: ['john.doe@lawfirm.com'],
    timestamp: new Date().toISOString()
  };

  try {
    const startTime = Date.now();
    const analysis = await openaiService.analyzeEmail(testEmail);
    const processingTime = Date.now() - startTime;

    console.log('   ✅ Analysis completed successfully');
    console.log(`   ⏱️  Processing time: ${processingTime}ms`);
    console.log('\n📊 Analysis Results:');
    console.log(`   - Estimated Time: ${analysis.estimatedTime} hours`);
    console.log(`   - Work Type: ${analysis.workType}`);
    console.log(`   - Confidence: ${analysis.confidence}%`);
    console.log(`   - Is Legal Email: ${analysis.isLegalEmail}`);
    console.log(`   - Suggested Client: ${analysis.suggestedClient}`);
    console.log(`   - Suggested Matter: ${analysis.suggestedMatter}`);
    console.log(`   - Urgency: ${analysis.urgency}`);
    console.log(`   - Legal Topics: ${analysis.legalTopics.join(', ')}`);
    console.log(`   - Billable Content: ${analysis.billableContent}`);
    console.log(`   - Reasoning: ${analysis.reasoning}`);

  } catch (error) {
    console.log('   ❌ Analysis failed:', error);
  }

  // Test batch analysis
  console.log('\n4. Batch Analysis Test:');
  const batchEmails: EmailAnalysisRequest[] = [
    {
      subject: 'Quick question about billing',
      content: 'Hi, just wanted to confirm the billing rate for next month.',
      sender: 'client@test.com',
      recipients: ['lawyer@firm.com']
    },
    {
      subject: 'Motion to Dismiss - Case #12345',
      content: 'Please prepare a motion to dismiss for the Smith v. Jones case. Deadline is next Tuesday.',
      sender: 'partner@firm.com',
      recipients: ['associate@firm.com']
    }
  ];

  try {
    const batchResults = await openaiService.batchAnalyzeEmails(batchEmails);
    console.log(`   ✅ Batch analysis completed for ${batchResults.length} emails`);
    
    batchResults.forEach((result, index) => {
      console.log(`   Email ${index + 1}: ${result.workType} (${result.estimatedTime}h, ${result.confidence}% confidence)`);
    });

  } catch (error) {
    console.log('   ❌ Batch analysis failed:', error);
  }

  console.log('\n🎉 OpenAI Integration Test Complete!');
}

// Run the test if this file is executed directly
if (require.main === module) {
  // Load environment variables for testing
  require('dotenv').config();
  
  testOpenAIIntegration()
    .then(() => {
      console.log('\n✅ Test execution finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { testOpenAIIntegration };
