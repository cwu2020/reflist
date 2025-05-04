export const metadata = {
  title: "Terms of Service - RefList",
  description: "RefList Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="prose prose-neutral max-w-none">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      
      <p className="text-neutral-500">
        Last updated: {new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      
      <div className="mt-6">
        <h2 className="text-xl font-semibold">1. Introduction</h2>
        <p>
          Welcome to RefList. These Terms of Service govern your use of our website, 
          applications, and services. By accessing or using RefList, you agree to be 
          bound by these Terms.
        </p>
        
        <h2 className="text-xl font-semibold mt-8">2. Definitions</h2>
        <p>
          In these Terms, "we", "us", and "our" refer to RefList, Inc. "Service" 
          refers to the RefList websites, applications, and services. "You" refers 
          to you, as a user of our Service.
        </p>
        
        <h2 className="text-xl font-semibold mt-8">3. Acceptance of Terms</h2>
        <p>
          By accessing or using our Service, you acknowledge that you have read, 
          understood, and agree to be bound by these Terms. If you do not agree to 
          these Terms, you should not use our Service.
        </p>
        
        <h2 className="text-xl font-semibold mt-8">4. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms at any time. We will provide 
          notice of any significant changes. Your continued use of the Service after 
          any such changes constitutes your acceptance of the new Terms.
        </p>
        
        <h2 className="text-xl font-semibold mt-8">5. Privacy Policy</h2>
        <p>
          Our Privacy Policy describes how we handle the information you provide to 
          us when you use our Service. By using our Service, you agree to our collection 
          and use of information as described in our Privacy Policy.
        </p>
        
        <p className="mt-12 text-sm text-neutral-500">
          This is a placeholder for the full terms of service. Please replace this content 
          with your complete terms of service document.
        </p>
      </div>
    </div>
  );
} 