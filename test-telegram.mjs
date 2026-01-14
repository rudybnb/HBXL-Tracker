// Test onboarding form generation
import fetch from 'node-fetch';

async function testOnboardingForm() {
  console.log('🧪 Testing onboarding form generation...');
  
  try {
    const response = await fetch('http://localhost:5000/api/send-onboarding-form', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contractorName: 'David Wilson',
        contractorPhone: '07934567890'
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ API error:', response.status, errorData);
      return;
    }

    const result = await response.json();
    console.log('✅ SUCCESS: Onboarding form sent');
    console.log('🆔 Contractor ID:', result.contractorId);
    console.log('📨 Message ID:', result.messageId);
    console.log('📱 Full response:', result);
    
  } catch (error) {
    console.error('💥 ERROR:', error.message);
  }
}

testOnboardingForm();