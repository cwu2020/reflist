"use client";

import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useState,
} from "react";

interface RegisterContextType {
  email: string;
  password: string;
  step: "signup" | "verify";
  phoneNumber?: string; // Optional phone number for claiming commissions
  claim?: boolean; // Flag to indicate if user is claiming commissions
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setPhoneNumber: (phoneNumber: string) => void; // Setter for phone number
  setClaim: (claim: boolean) => void; // Setter for claim flag
  setStep: (step: "signup" | "verify") => void;
  lockEmail?: boolean;
}

const RegisterContext = createContext<RegisterContextType | undefined>(
  undefined,
);

export const RegisterProvider: React.FC<
  PropsWithChildren<{ 
    email?: string; 
    phoneNumber?: string;
    claim?: boolean; 
    lockEmail?: boolean;
  }>
> = ({ email: emailProp, phoneNumber: phoneNumberProp, claim: claimProp, lockEmail, children }) => {
  const [email, setEmail] = useState(emailProp ?? "");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(phoneNumberProp ?? "");
  const [claim, setClaim] = useState(claimProp ?? false);
  const [step, setStep] = useState<"signup" | "verify">("signup");

  return (
    <RegisterContext.Provider
      value={{
        email,
        password,
        phoneNumber,
        claim,
        step,
        setEmail,
        setPassword,
        setPhoneNumber,
        setClaim,
        setStep,
        lockEmail,
      }}
    >
      {children}
    </RegisterContext.Provider>
  );
};

export const useRegisterContext = () => {
  const context = useContext(RegisterContext);
  if (!context) {
    throw new Error(
      "useRegisterContext must be used within a RegisterContextProvider",
    );
  }
  return context;
};
