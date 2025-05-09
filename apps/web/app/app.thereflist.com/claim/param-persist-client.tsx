"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function ParamPersistClient() {
  const searchParams = useSearchParams();
  
  // Handle and persist parameters
  useEffect(() => {
    // Check if we have a pendingPhoneVerification in the URL
    const pendingPhoneParam = searchParams.get("pendingPhoneVerification");
    
    if (pendingPhoneParam && typeof window !== "undefined") {
      console.log(`[ParamPersistClient] Found pendingPhoneVerification in URL: ${pendingPhoneParam}, storing in sessionStorage`);
      
      // Store in sessionStorage for retrieval either by our client component 
      // or by the login handler if we're redirected to auth
      sessionStorage.setItem("pendingPhoneVerification", pendingPhoneParam);
      
      // Also call the server API to store in a cookie
      fetch('/api/auth/phone-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: pendingPhoneParam }),
      })
      .then(response => {
        if (response.ok) {
          console.log('Successfully stored phone number in server-side cookie');
        } else {
          console.error('Failed to store phone number in server-side cookie');
        }
      })
      .catch(error => {
        console.error('Error storing phone number in server-side cookie:', error);
      });
    }
  }, [searchParams]);
  
  // This is a utility component with no visual output
  return null;
} 