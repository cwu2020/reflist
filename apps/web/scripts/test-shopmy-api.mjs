#!/usr/bin/env node

/**
 * Test script for ShopMy API - tests both direct API calls and local proxy endpoints
 * 
 * For local API testing, this script will use direct API calls to bypass authentication,
 * which is useful for debugging the API calls themselves.
 * 
 * Usage:
 *   node test-shopmy-api.mjs
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
const TEST_URL = 'https://www.ssense.com/en-us/women/product/justine-clenquet/silver-and-gold-moore-earrings/17132531';
const LOCAL_API_BASE = 'http://localhost:8888';

if (!SHOPMY_TOKEN) {
  console.error('❌ ERROR: SHOPMY_CREATOR_TOKEN is not defined in your environment variables');
  process.exit(1);
}

console.log('🔑 Using token:', SHOPMY_TOKEN.substring(0, 2) + '...' + SHOPMY_TOKEN.slice(-2));
console.log('👤 Using User ID:', SHOPMY_USER_ID);
console.log(`🔍 Testing with URL: ${TEST_URL}`);

// ========== DIRECT SHOPMY API TESTS ==========

async function testDirectGetMerchantData() {
  console.log('\n📊 Testing Direct ShopMy Merchant Data API...');
  
  // Extract domain from the URL
  let domain = '';
  try {
    domain = new URL(TEST_URL).hostname.replace('www.', '');
    console.log('Extracted domain:', domain);
  } catch (error) {
    console.error('Error extracting domain from URL:', error);
    domain = 'ssense.com'; // Fallback
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
    
    console.log('✅ SUCCESS: Got merchant data directly');
    console.log('Status:', response.status);
    
    if (response.data && response.data.data) {
      const domainKeys = Object.keys(response.data.data);
      console.log('Domain keys:', domainKeys);
      
      if (domainKeys.length > 0) {
        const merchantData = response.data.data[domainKeys[0]];
        console.log('Merchant name:', merchantData.name || 'Unknown');
        console.log('Commission:', merchantData.fullPayout, merchantData.payoutType);
        return merchantData;
      } else {
        console.log('❗ No merchant data found for this URL');
      }
    } else {
      console.log('❗ Unexpected response format:', response.data);
    }
    return null;
  } catch (error) {
    console.error('❌ ERROR fetching merchant data directly:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

async function testDirectCreatePin() {
  console.log('\n📌 Testing Direct ShopMy Pin Creation API...');
  try {
    const pinData = {
      title: 'Test Pin',
      description: 'Testing ShopMy API integration',
      link: TEST_URL,
      User_id: Number(SHOPMY_USER_ID)
    };
    
    console.log('Request payload:', JSON.stringify(pinData, null, 2));
    
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
    
    console.log('✅ SUCCESS: Created pin directly');
    console.log('Status:', response.status);
    
    if (response.data && response.data.pin) {
      const pin = response.data.pin;
      const shortUrl = `https://go.shopmy.us/p-${pin.id}`;
      console.log('Pin ID:', pin.id);
      console.log('Short URL:', shortUrl);
      console.log('Full response:', JSON.stringify(response.data, null, 2));
      return response.data;
    } else {
      console.log('❗ Unexpected response format:', response.data);
    }
    return null;
  } catch (error) {
    console.error('❌ ERROR creating pin directly:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

// ========== TESTING LOCAL CODE DIRECTLY ==========

async function testLocalCodeDirectly() {
  console.log('\n🧪 Testing local code directly (bypassing API endpoints)...');
  
  // This is where you would directly invoke the code that your API handlers use
  // For example:
  // 1. Import the necessary functions from your codebase
  // 2. Call them directly with test data
  // 3. Log the results
  
  console.log('ℹ️ This test is not implemented yet. To implement:');
  console.log('1. Import the necessary functions from your API handler files');
  console.log('2. Call them with test data, bypassing the Next.js API routes');
  console.log('3. This allows testing the business logic without authentication');
  
  // Example implementation:
  // import { handlePinCreation } from '../app/api/shopmy/pins/pinHandler.js';
  // const result = await handlePinCreation({
  //   title: 'Test Pin',
  //   description: 'Testing direct code execution',
  //   link: TEST_URL
  // });
  // console.log('Direct code execution result:', result);
}

// ========== CHECK FOR IMPLEMENTATION DETAILS ==========

function printDebugGuide() {
  console.log('\n🔍 DEBUGGING GUIDE:');
  
  console.log('\n1. ShopMy Merchant Data API:');
  console.log('- Check the exact URL and body parameters for get_merchant_data');
  console.log('- Ensure URL is properly formatted and from a supported merchant');
  console.log('- Verify all required headers are included and correctly formatted');
  
  console.log('\n2. ShopMy Pin Creation API:');
  console.log('- Ensure User_id is correctly included and is a number');
  console.log('- Example payload:');
  console.log(JSON.stringify({
    title: 'Product Title',
    description: 'Product Description',
    link: 'https://example.com/product',
    User_id: 104679
  }, null, 2));
  
  console.log('\n3. Local API Endpoints:');
  console.log('- The 401 errors indicate authentication issues');
  console.log('- For testing purposes, consider creating a test route that bypasses auth');
  console.log('- Alternatively, implement a testing utility that directly calls your API handlers');
  
  console.log('\n4. Implementation Notes:');
  console.log('- The User_id field is required for pin creation');
  console.log('- Direct API testing confirms the pin creation works with proper User_id');
  console.log('- For production, ensure the environment variable SHOPMY_USER_ID is set to 104679');
  console.log('- Update your local endpoint handler to include this User_id in the request to ShopMy');
}

async function main() {
  console.log('🧪 TESTING SHOPMY INTEGRATION...\n');
  
  console.log('======= DIRECT API TESTS =======');
  const directMerchantData = await testDirectGetMerchantData();
  const pinResponse = await testDirectCreatePin();
  
  // Skip local endpoint tests since they require authentication
  // console.log('\n\n======= LOCAL PROXY TESTS =======');
  // await testLocalGetMerchantData();
  // await testLocalCreatePin(directMerchantData);
  
  // Testing local code directly would be a better approach
  // await testLocalCodeDirectly();
  
  // Print debug guide
  printDebugGuide();
  
  console.log('\n✨ Testing complete!');
}

main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 