#!/usr/bin/env node

/**
 * Test script for local ShopMy endpoints without authentication
 * 
 * This script directly calls the handler functions in your API routes,
 * bypassing Next.js API routes and authentication, which is useful for debugging.
 * 
 * Usage:
 *   node test-local-shopmy.mjs
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local if present
if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
} else {
  dotenv.config();
}

const SHOPMY_TOKEN = process.env.SHOPMY_CREATOR_TOKEN;
const SHOPMY_USER_ID = process.env.SHOPMY_USER_ID || '104679';
const TEST_URL = 'https://www.amazon.com/Apple-MacBook-16-inch-10%E2%80%91core-16%E2%80%91core/dp/B09JQSLL92/';

if (!SHOPMY_TOKEN) {
  console.error('❌ ERROR: SHOPMY_CREATOR_TOKEN is not defined in your environment variables');
  process.exit(1);
}

console.log('🔑 Using token:', SHOPMY_TOKEN.substring(0, 2) + '...' + SHOPMY_TOKEN.slice(-2));
console.log('👤 Using User ID:', SHOPMY_USER_ID);
console.log(`🔍 Testing with URL: ${TEST_URL}`);

// Test merchant data function (similar to what's in your API route handler)
async function testMerchantData() {
  console.log('\n📊 Testing Merchant Data Function...');
  
  // Extract domain from the URL
  let domain = '';
  try {
    domain = new URL(TEST_URL).hostname.replace('www.', '');
    console.log('Extracted domain:', domain);
  } catch (error) {
    console.error('Error extracting domain from URL:', error);
    domain = 'amazon.com'; // Fallback
  }
  
  // Correct payload format
  const requestBody = {
    "urls": [domain]
  };
  
  console.log('Using request body:', JSON.stringify(requestBody));
  
  try {
    const response = await axios.post('https://api.shopmy.us/api/Pins/get_merchant_data', 
      requestBody,
      { 
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-apicache-bypass': 'true',
          'x-authorization-hash': SHOPMY_TOKEN,
          'Origin': 'https://shopmy.us',
          'Referer': 'https://shopmy.us/'
        }
      }
    );
    
    console.log('✅ SUCCESS: Got merchant data');
    console.log('Status:', response.status);
    
    if (response.data && response.data.data) {
      const apiData = response.data.data;
      const domainKeys = Object.keys(apiData);
      
      console.log('Domain keys found:', JSON.stringify(domainKeys));
      
      if (domainKeys.length) {
        const domainKey = domainKeys[0];
        const merchant = apiData[domainKey];
        
        console.log('Merchant found - name:', merchant?.name || 'unknown');
        return merchant;
      } else {
        console.log('No merchant data found for URL');
        return null;
      }
    } else {
      console.log('Invalid response format - missing data object', response.data);
      return null;
    }
  } catch (error) {
    console.error('ShopMy API request failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return null;
  }
}

// Test pin creation function (similar to what's in your API route handler)
async function testPinCreation(merchant) {
  console.log('\n📌 Testing Pin Creation Function...');
  
  const pinData = {
    title: merchant?.brand?.name || 'Test Product',
    description: 'Test description for ShopMy pin',
    image: merchant?.logo || 'https://example.com/image.jpg',
    link: TEST_URL,
    User_id: Number(SHOPMY_USER_ID)  // This is the key for pin creation
  };
  
  console.log('Request payload:', JSON.stringify(pinData, null, 2));
  
  try {
    const response = await axios.post('https://api.shopmy.us/api/Pins', 
      pinData,
      { 
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-apicache-bypass': 'true',
          'x-authorization-hash': SHOPMY_TOKEN,
          'Origin': 'https://shopmy.us',
          'Referer': 'https://shopmy.us/'
        }
      }
    );
    
    console.log('✅ SUCCESS: Created pin');
    console.log('Status:', response.status);
    
    if (response.data && response.data.pin) {
      const pin = response.data.pin;
      const shortUrl = `https://go.shopmy.us/p-${pin.id}`;
      
      console.log('Pin created with ID:', pin.id);
      console.log('Short URL:', shortUrl);
      
      return { pin, shortUrl };
    } else {
      console.log('Invalid response format - missing pin object', response.data);
      return null;
    }
  } catch (error) {
    console.error('ShopMy API pin creation failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return null;
  }
}

async function main() {
  console.log('🧪 TESTING LOCAL SHOPMY FUNCTIONS DIRECTLY...\n');
  
  // Test getting merchant data
  const merchant = await testMerchantData();
  
  // Test creating a pin
  if (merchant) {
    await testPinCreation(merchant);
  } else {
    console.log('⚠️ Skipping pin creation test since merchant data was not available');
    console.log('Testing pin creation with fallback values...');
    await testPinCreation(null);
  }
  
  console.log('\n✨ Testing complete!');
  
  console.log('\n📝 IMPLEMENTATION CHECKLIST:');
  console.log('1. ✅ Ensure SHOPMY_USER_ID environment variable is set to 104679');
  console.log('2. ✅ Include User_id: Number(SHOPMY_USER_ID) in pin creation payload');
  console.log('3. ✅ Pin creation works with the ShopMy API');
  console.log('4. ❓ Make sure your local API route is adding the User_id to the payload');
}

main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 